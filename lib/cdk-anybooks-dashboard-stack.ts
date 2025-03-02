import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { BedrockCwDashboard } from './aws-bedrock-cw-dashboard-custom';

export class CdkAnybooksDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bddashboard = new BedrockCwDashboard(this, 'BedrockDashboardConstruct');

    // provides monitoring of all models
    bddashboard.addAllModelsMonitoring({
      period: cdk.Duration.minutes(1)
    });

    // provides monitoring for a specific model
    // bddashboard.addModelMonitoring('claude3haiku', 'anthropic.claude-3-haiku-20240307-v1:0');
    // for nova
    // bddashboard.addModelMonitoring('Amazon Nova Pro', 'us.amazon.nova-pro-v1:0', {});

    // provides monitoring for a specific model with on-demand pricing calculation
    // pricing details are available here: https://aws.amazon.com/bedrock/pricing/
    // 입력 토큰 1,000개당 요금, 출력 토큰 1,000개당 요금
    bddashboard.addModelMonitoring('Claude 3.5 Sonnet v2', bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0.modelId, {
        inputTokenPrice: 0.003,
        outputTokenPrice: 0.015,
        period: cdk.Duration.minutes(1)
    });

    bddashboard.addModelMonitoring('Claude 3.7 Sonnet', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
      period: cdk.Duration.minutes(1)
  });
   
  }
}
