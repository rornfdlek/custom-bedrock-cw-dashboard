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

    // provides monitoring for a specific model with on-demand pricing calculation
    // pricing details are available here: https://aws.amazon.com/bedrock/pricing/
    bddashboard.addModelMonitoring('anthropic.claude-3-5-sonnet-20241022-v2:0', bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0.modelId, {
        inputTokenPrice: 0.00025,
        outputTokenPrice: 0.00125,
        period: cdk.Duration.minutes(1)
    });
   
  }
}
