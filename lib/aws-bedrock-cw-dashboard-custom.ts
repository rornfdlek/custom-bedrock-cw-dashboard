/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Duration, Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import {
  Metric,
  Dashboard,
  GraphWidget,
  SingleValueWidget,
  Row,
  Stats,
  TextWidget,
  MathExpression,
  GaugeWidget,
  LegendPosition,
  Shading,
  GraphWidgetView,
  LogQueryWidget,
  LogQueryVisualizationType,
  Color,
  AlarmStatusWidget,
  IAlarm,
  Alarm,
  AlarmRule,
  AlarmWidget
} from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

/**
 * The properties for the ModelMonitoringProps class.
 */
export interface ModelMonitoringProps {
  /*
    * Optional - The period over which the specified statistic is applied.
    * @default - 1 hour
    */
  readonly period?: Duration;
  /*
    * Optional - Only applicable for image generation models.
    * Used for the OutputImageCount metric as follows:
    * "ModelId + ImageSize + BucketedStepSize"
    * @default - empty
    */
  readonly imageSize?: string;
  /*
    * Optional - Only applicable for image generation models.
    * Used for the OutputImageCount metric as follows:
    * "ModelId + ImageSize + BucketedStepSize"
    * @default - empty
    */
  readonly bucketedStepSize?: string;
  /*
  * Optional - Cost per 1K input tokens
  * Used Only for single model monitoring
  * Used to compute on-demand input and total tokens cost
  * for a specific model. Please refer to https://aws.amazon.com/bedrock/pricing/
  * for pricing details.
  * @default - empty
  */
  readonly inputTokenPrice?: number;
  /*
  * Optional - Cost per 1K output tokens
  * Used Only for single model monitoring
  * Used to compute on-demand input and total tokens cost
  * for a specific model. Please refer to https://aws.amazon.com/bedrock/pricing/
  * for pricing details.
  * @default - empty
  */
  readonly outputTokenPrice?: number;
}

/**
 * The properties for the BedrockCwDashboardProps class.
 */
export interface BedrockCwDashboardProps {

  /**
   * Optional An existing dashboard where metrics will be added to.
   * If not provided, the construct will create a new dashboard
   *
   * @default - none
   */
  readonly existingDashboard?: Dashboard;

  /**
   * Optional A name for the dashboard which will be created.
   * If existingDashboard is defined, this value will be ignored.
   * If not provided, the construct will create a new dashboard named 'BedrockMetricsDashboard'
   *
   * @default - none
   */
  readonly dashboardName?: string;
}

/**
 * The BedrockCwDashboard class.
 */
export class BedrockCwDashboard extends Construct {

  /**
   * Returns the instance of CloudWatch dashboard used by the construct
   */
  public readonly dashboard: Dashboard;

  /**
   * Constructs a new instance of the BedrockCwDashboard class.
   * @param {cdk.App} scope - represents the scope for all the resources.
   * @param {string} id - this is a a scope-unique id.
   * @param {BedrockCwDashboardProps} props - user provided props for the construct.
   * @since 0.0.0
   * @public
   */
  constructor(scope: Construct, id: string, props: BedrockCwDashboardProps = {}) {
    super(scope, id);

    this.dashboard = props.existingDashboard ?? new Dashboard(this, `BedrockMetricsDashboard${id}`, {
      dashboardName: props.dashboardName ?? 'AnyBooksMonitoringDashboard',
    });

    const cloudwatchDashboardURL = 'https://' + Aws.REGION + '.console.aws.amazon.com/cloudwatch/home?region=' + Aws.REGION + '#dashboards:name=' + this.dashboard.dashboardName;

    new CfnOutput(this, `BedrockMetricsDashboardOutput${id}`, {
      value: cloudwatchDashboardURL,
    });
  }

  /* Provide metrics for a specific model id in Bedrock
   * @param {string} modelName - Model name as it will appear in the dashboard row widget.
   * @param {string} modelId - Bedrock model id as defined in https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
   * @param {ModelMonitoringProps} props - user provided props for the monitoring.
  */
  public addModelMonitoring(modelName: string, modelId: string, props: ModelMonitoringProps = {}) {

    const period = props.period ?? Duration.minutes(1);
    const outputImageCountDimension = modelId + props.imageSize + props.bucketedStepSize;

    const modelInputTokensMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InputTokenCount',
      dimensionsMap: {
        ModelId: modelId,
      },
      statistic: Stats.SUM,
      period: period,
    });

    const modelOutputTokensMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'OutputTokenCount',
      dimensionsMap: {
        ModelId: modelId,
      },
      statistic: Stats.SUM,
      period: period,
    });

    const modelOutputImageMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'OutputImageCount',
      dimensionsMap: {
        ModelId: outputImageCountDimension,
      },
      statistic: Stats.SUM,
      period: period,
    });

    const modelLatencyAvgMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      dimensionsMap: {
        ModelId: modelId,
      },
      statistic: Stats.AVERAGE,
      period: period,
    });

    const modelLatencyMinMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      dimensionsMap: {
        ModelId: modelId,
      },
      statistic: Stats.MINIMUM,
      period: period,
    });

    const modelLatencyMaxMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      dimensionsMap: {
        ModelId: modelId,
      },
      statistic: Stats.MAXIMUM,
      period: period,
    });

    const modelInvocationsCountMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'Invocations',
      dimensionsMap: {
        ModelId: modelId,
      },
      // statistic: Stats.SAMPLE_COUNT,
      statistic: Stats.SUM, // 1분 내 호출 수를 합산해야 함
      period: period,
    });

    const modelInvocationsClientErrorsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationClientErrors',
      dimensionsMap: {
        ModelId: modelId,
      },
      // statistic: Stats.SAMPLE_COUNT,
      statistic: Stats.SUM,
      period: period,
    });

    const modelInvocationsServerErrorsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationServerErrors',
      dimensionsMap: {
        ModelId: modelId,
      },
      // statistic: Stats.SAMPLE_COUNT,
      statistic: Stats.SUM,
      period: period,
    });

    const modelInvocationsThrottlesErrorsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationThrottles',
      dimensionsMap: {
        ModelId: modelId,
      },
      // statistic: Stats.SAMPLE_COUNT,
      statistic: Stats.SUM,
      period: period,
    });

    const modelInvocationsLegacysMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'LegacyModelInvocations',
      dimensionsMap: {
        ModelId: modelId,
      },
      // statistic: Stats.SAMPLE_COUNT,
      statistic: Stats.SUM,
      period: period,
    });


    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: `# ${modelName}`,
          width: 24,
        }),
      ),
    );

    this.dashboard.addWidgets(
      new Row(
        new SingleValueWidget({
          title: 'Average Latency',
          metrics: [modelLatencyAvgMetric],
          setPeriodToTimeRange: true,
          width: 8,
        }),
        new SingleValueWidget({
          title: 'Min Latency',
          metrics: [modelLatencyMinMetric],
          setPeriodToTimeRange: true,
          width: 8,
        }),
        new SingleValueWidget({
          title: 'Max Latency',
          metrics: [modelLatencyMaxMetric],
          setPeriodToTimeRange: true,
          width: 8,
        }),
      ),
    );

    let pricingWidget;

    if (props.inputTokenPrice && props.outputTokenPrice) {
      pricingWidget =
          new GraphWidget({
            title: 'Token Cost (USD)',
            left: [
              new MathExpression({
                expression: `inputTokens / 1000 * ${props.inputTokenPrice}`,
                usingMetrics: {
                  inputTokens: modelInputTokensMetric,
                },
                label: 'Input Token Cost',
              }),
              new MathExpression({
                expression: `outputTokens / 1000 * ${props.outputTokenPrice}`,
                usingMetrics: {
                  outputTokens: modelOutputTokensMetric,
                },
                label: 'Output Token Cost',
              }),
            ],
            leftYAxis: {
              label: 'Input and Output',
              showUnits: false,
            },
            right: [
              new MathExpression({
                expression: `inputTokens / 1000 * ${props.inputTokenPrice} + outputTokens / 1000 * ${props.outputTokenPrice}`,
                usingMetrics: {
                  inputTokens: modelInputTokensMetric,
                  outputTokens: modelOutputTokensMetric,
                },
                label: 'Total Cost',
              }),
            ],
            rightYAxis: {
              label: 'Total',
              showUnits: false,
            },
            width: 12,
            height: 10,
          });
    }

    this.dashboard.addWidgets(
      new Row(
        new GraphWidget({
          title: 'Input and Output Token Counts',
          left: [modelInputTokensMetric],
          right: [modelOutputTokensMetric],
          period: period,
          width: 12,
          height: 10,
        }),
        ...(pricingWidget ? [pricingWidget] : []),
      ));

    this.dashboard.addWidgets(
      new SingleValueWidget({
        title: 'Invocations',
        metrics: [modelInvocationsCountMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
      new SingleValueWidget({
        title: 'Client Errors',
        metrics: [modelInvocationsClientErrorsMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
      new SingleValueWidget({
        title: 'Server Errors',
        metrics: [modelInvocationsServerErrorsMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
      new SingleValueWidget({
        title: 'Throttled invocations',
        metrics: [modelInvocationsThrottlesErrorsMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
      new SingleValueWidget({
        title: 'Legacy invocations',
        metrics: [modelInvocationsLegacysMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
      new SingleValueWidget({
        title: 'OutputImageCount',
        metrics: [modelOutputImageMetric],
        setPeriodToTimeRange: true,
        width: 4,
      }),
    );
  }

  /* Add a new row to the dashboard providing metrics across all model ids in Bedrock
  * @param {ModelMonitoringProps} props - user provided props for the monitoring.
  */
  public addAllModelsMonitoring(props: ModelMonitoringProps = {}) {

    const period = props.period ?? Duration.minutes(1);

    const color =  "#caedfc";

    // Metrics across all Model Ids
    const inputTokensAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InputTokenCount',
      statistic: Stats.SUM,
      period: period,
    });

    const outputTokensAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'OutputTokenCount',
      statistic: Stats.SUM,
      period: period,
    });

    const titanEmbedTextV2modelLatencyAvgMetric = new Metric({
        namespace: 'AWS/Bedrock',
        metricName: 'InvocationLatency',
        dimensionsMap: {
          ModelId: 'arn:aws:bedrock:us-west-2::foundation-model/amazon.titan-embed-text-v2:0',
        },
        statistic: Stats.AVERAGE,
        period: period,
        color: color,
        label: "평균 호출 지연 시간"
    });

    const claude35sonnetmodelLatencyAvgMetric = new Metric({
        namespace: 'AWS/Bedrock',
        metricName: 'InvocationLatency',
        dimensionsMap: {
          ModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',

        },
        statistic: Stats.AVERAGE,
        period: period,
        color: color,
        label: "평균 호출 지연 시간"
    });

    const claude35sonnetmodelInvocationsPerMinMetric = new Metric({
        namespace: 'AWS/Bedrock',
        metricName: 'Invocations',
        dimensionsMap: {
          ModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        },
        statistic: Stats.SUM, // 1분 내 호출 수를 합산해야 함
        period: Duration.minutes(1), // 수집 주기 = 1분
        color: color,
        label: "1분당 호출 수"
    });

    const outputImageMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'OutputImageCount',
      statistic: Stats.SUM,
      period: period,
    });

    const latencyAvgAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      statistic: Stats.AVERAGE,
      period: period,
      color: color
    });

    const latencyMinAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      statistic: Stats.MINIMUM,
      period: period,
      color: color
    });

    const latencyMaxAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationLatency',
      statistic: Stats.MAXIMUM,
      period: period,
      color: color
    });

    const invocationsCountAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'Invocations',
      statistic: Stats.SUM,
      period: period,
      color: color,
      label: "전체 호출 수"
    });

    const invocationsClientErrorsAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationClientErrors',
      statistic: Stats.SUM,
      period: period,
      color: color
    });

    const invocationsServerErrorsAllModelsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationServerErrors',
      statistic: Stats.SUM,
      period: period,
      color: color
    });

    const invocationsThrottlesErrorsMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InvocationThrottles',
      statistic: Stats.SUM,
      period: period,
      color: color
    });

    const invocationsLegacyModelMetric = new Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'LegacyModelInvocations',
      statistic: Stats.SUM,
      period: period,
    });
    
    const guadrailsInvocationsIntervenedMetric = new Metric({
      namespace: 'AWS/Bedrock/Guardrails',
      metricName: 'InvocationsIntervened',
      dimensionsMap: {
        Operation: 'ApplyGuardrail'
      },
      statistic: Stats.SUM,
      period: period,
      color: Color.RED,
    });

    const guadrailsTextUnitCountTextUnitCountMetric = new Metric({
      namespace: 'AWS/Bedrock/Guardrails',
      metricName: 'TextUnitCount',
      dimensionsMap: {
        Operation: 'ApplyGuardrail'
      },
      statistic: Stats.SUM,
      period: period,
      color: Color.ORANGE,
    });


    this.dashboard.addWidgets(
      new Row(
        new TextWidget({
          markdown: '# 🎯 AnyBooks Chatbot 모니터링 대시보드 \n AnyBooks의 챗봇에 대한 핵심 모니터링 위젯들을 제공합니다: \n'
                    + '* 모델 호출 수 \n * 모델별 지연 시간 \n * 모델별 input/output 토큰 수 \n * 토큰 사용량에 따른 비용 산정 \n * 에러 수 (Client/Server Error, Throttling Errors) \n'
                    + '* 애플리케이션 로그',
          width: 6,
          height: 6,
        }),
        new GaugeWidget({
            title: 'Average Latency (All Models)',
            metrics: [latencyAvgAllModelsMetric],
            width: 6,
            height: 6,
            period: period,
            setPeriodToTimeRange: true,
            liveData: true,
            leftYAxis: {min: 0, max: 15000},
            legendPosition: LegendPosition.BOTTOM,
            annotations: [{color: "#b2df8d", label: '5초 미만', value: 5000, fill: Shading.BELOW},
                          {color: "#f89256", label: '5초 초과 8초 미만', value: 5000, fill: Shading.ABOVE},
                          {color: "#fe6e73", label: '8초 초과', value: 8000, fill: Shading.ABOVE},
            ] 
        }),
          new GaugeWidget({
            title: 'Min Latency (All Models)',
            metrics: [latencyMinAllModelsMetric],
            width: 6,
            height: 6,
            period: period,
            setPeriodToTimeRange: true,
            liveData: true,
            leftYAxis: {min: 0, max: 15000},
            legendPosition: LegendPosition.BOTTOM,
            annotations: [{color: "#b2df8d", label: '5초 미만', value: 5000, fill: Shading.BELOW},
                          {color: "#f89256", label: '5초 초과 8초 미만', value: 5000, fill: Shading.ABOVE},
                          {color: "#fe6e73", label: '8초 초과', value: 8000, fill: Shading.ABOVE},
            ] 
          }),
          new GaugeWidget({
            title: 'Max Latency (All Models)',
            metrics: [latencyMaxAllModelsMetric],
            width: 6,
            height: 6,
            period: period,
            setPeriodToTimeRange: true,
            liveData: true,
            leftYAxis: {min: 0, max: 15000},
            legendPosition: LegendPosition.BOTTOM,
            annotations: [{color: "#b2df8d", label: '5초 미만', value: 5000, fill: Shading.BELOW},
                          {color: "#f89256", label: '5초 초과 8초 미만', value: 5000, fill: Shading.ABOVE},
                          {color: "#fe6e73", label: '8초 초과', value: 8000, fill: Shading.ABOVE},
            ] 
          }),
      ),
    );

    this.dashboard.addWidgets(
      new Row(
        new GraphWidget({
          title: 'Input and Output Tokens (All Models)',
          left: [inputTokensAllModelsMetric],
          right: [outputTokensAllModelsMetric],
          period: period,
          width: 12,
        }),
        new SingleValueWidget({
            title: 'Invocations (All Models)',
            metrics: [invocationsCountAllModelsMetric],
            width: 4,
            height: 4,
            period: period,
            setPeriodToTimeRange: true
          }),
        new SingleValueWidget({
            title: '[Titan Text Embeddings V2] Invocation Latency',
            metrics: [titanEmbedTextV2modelLatencyAvgMetric],
            width: 4,
            height: 4,
            period: period,
            setPeriodToTimeRange: true,
          }),
        new SingleValueWidget({
          title: '[Claude 3.5 Sonnet] Invocation Latency',
          metrics: [claude35sonnetmodelLatencyAvgMetric],
          width: 4,
          height: 4,
          period: period,
          setPeriodToTimeRange: true,
        }),
        new SingleValueWidget({
            title: 'Client Errors (All Models)',
            metrics: [invocationsClientErrorsAllModelsMetric],
            period: period,
            setPeriodToTimeRange: true,
            width: 4,
          }),
        new SingleValueWidget({
          title: 'Server Errors (All Models)',
          metrics: [invocationsServerErrorsAllModelsMetric],
          period: period,
          setPeriodToTimeRange: true,
          width: 4,
        }),
        new SingleValueWidget({
          title: 'Throttling Errors (All Models)',
          metrics: [invocationsThrottlesErrorsMetric],
          period: period,
          setPeriodToTimeRange: true,
          width: 4,
        }),
        new GraphWidget({
            title: '[Claude 3.5 Sonnet] 분당 호출 수',
            period: Duration.minutes(1), // 1분 주기로 집계
            width: 6, 
            height: 5,
            left: [
                claude35sonnetmodelInvocationsPerMinMetric,
            ],
            leftAnnotations: [{
                label: "Quota limit",
                value: 250,
                color: "#ff0000"
            }]
        }),
        // Feedback thumbs up or down pie chart
        new LogQueryWidget({
          title: '응답 선호도',
          logGroupNames: ['anybooks-streamlit-app'],
          queryString: `
              fields @timestamp, @message
              | filter @message like "[Feedback]"
              | parse @message "[Feedback] *" as feedback
              | stats count() as count by feedback
            `,
          view: LogQueryVisualizationType.PIE,
          width: 6,
          height: 5,
        }),
        new SingleValueWidget({
          title: '가드레일이 개입된 호출 수',
          metrics: [guadrailsInvocationsIntervenedMetric],
          width: 6,
          height: 4,
          period: period,
          setPeriodToTimeRange: true,
        }),
        new SingleValueWidget({
          title: '가드레일 정책이 소비한 text unit 수',
          metrics: [guadrailsTextUnitCountTextUnitCountMetric],
          width: 6,
          height: 4,
          period: period,
          setPeriodToTimeRange: true,
        }),
        // 결제 성공/실패 pie chart
        new LogQueryWidget({
          title: '결제 성공 / 실패',
          logGroupNames: ['/aws/lambda/lambda-bedrock-agent'],
          queryString: `
              fields @timestamp, @message
              | filter @message like "[PAY]"
              | parse @message "[PAY]*" as payment
              | stats count() as count by payment
            `,
          view: LogQueryVisualizationType.PIE,
          width: 6,
          height: 4,
        }),
        new AlarmStatusWidget({
          title: "알람 발생 현황",
          alarms: [
            Alarm.fromAlarmArn(this, 'Alarm', 'arn:aws:cloudwatch:us-west-2:682033488544:alarm:Bedrock 모델 호출 수 임계치 초과'),
            Alarm.fromAlarmArn(this, 'Alarm2', 'arn:aws:cloudwatch:us-west-2:682033488544:alarm:Action Group Lambda 에러 수 임계치 초과'),
            Alarm.fromAlarmArn(this, 'Alarm3', 'arn:aws:cloudwatch:us-west-2:682033488544:alarm:Claude 3.5 Sonnet V2 호출 비용 임계치 초과'),
          ],
          width: 6,
          height: 4
        }),
        // 결제 로그 테이블
        new LogQueryWidget({
          title: '결제 로그',
          logGroupNames: ['/aws/lambda/lambda-bedrock-agent'],
          queryString: `
              filter @message like "[PAY]"
              | fields @timestamp
              | parse @message "[PAY]*" as payment
              | fields @logStream, @log
              | sort @timestamp desc
              | limit 100
            `,
          view: LogQueryVisualizationType.TABLE,
          width: 24
        }),
      ),
    );
  }
}
