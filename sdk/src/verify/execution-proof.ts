import type { ExecutionProof, StepRecord, Artifact, SuccessClaim } from './omworld-types.js';
import { jcsHash } from './jcs.js';

export class ExecutionProofBuilder {
  private specVersion: string;

  constructor(specVersion: string = '0.2.0') {
    this.specVersion = specVersion;
  }

  async build(options: {
    intentId: string;
    mandateId: string;
    plan: string;
    steps: Array<Omit<StepRecord, 'prev_hash' | 'input_hash' | 'output_hash'>>;
    artifacts?: Artifact[];
    successClaim?: SuccessClaim;
    sign?: (hash: string) => Promise<string>;
  }): Promise<ExecutionProof> {
    const stepRecords = await this.buildStepRecords(options.steps);
    const artifacts = options.artifacts || [];
    const successClaim = options.successClaim || this.defaultSuccessClaim();

    const proof: ExecutionProof = {
      spec_version: this.specVersion,
      intent_id: options.intentId,
      mandate_id: options.mandateId,
      plan: options.plan,
      steps: stepRecords,
      artifacts,
      success_claim: successClaim,
    };

    if (options.sign) {
      const forHash = { ...proof };
      delete forHash.signature;
      const hash = await jcsHash(forHash);
      proof.signature = await options.sign(hash);
    }

    return proof;
  }

  async buildStepRecords(
    steps: Array<Omit<StepRecord, 'prev_hash' | 'input_hash' | 'output_hash'>>
  ): Promise<StepRecord[]> {
    const records: StepRecord[] = [];
    let prevHash = '0x' + '0'.repeat(64);

    for (const step of steps) {
      const inputHash = await jcsHash(step.input);
      const outputHash = await jcsHash(step.output);
      const contextHash = step.context_hash
        || (typeof step.output === 'object' && step.output !== null
          ? await jcsHash(step.output)
          : undefined);

      const record: StepRecord = {
        ...step,
        prev_hash: prevHash,
        input_hash: inputHash,
        output_hash: outputHash,
        context_hash: contextHash,
      };

      if (step.signature) {
        record.signature = step.signature;
      }

      const recordHash = await jcsHash(record);
      prevHash = recordHash;
      records.push(record);
    }

    return records;
  }

  async computeStepHash(step: StepRecord): Promise<string> {
    return jcsHash(step);
  }

  private defaultSuccessClaim(): SuccessClaim {
    return {
      outcome: 'success',
      summary: 'All steps completed',
    };
  }
}

export function createStep(options: {
  index: number;
  tool: string;
  input: unknown;
  output: unknown;
  timestamp?: string;
}): Omit<StepRecord, 'prev_hash' | 'input_hash' | 'output_hash'> {
  return {
    index: options.index,
    tool: options.tool,
    input: options.input,
    output: options.output,
    timestamp: options.timestamp || new Date().toISOString(),
  };
}
