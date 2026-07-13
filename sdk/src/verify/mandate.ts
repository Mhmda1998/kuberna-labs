import type { Mandate, IdScheme } from './omworld-types.js';
import { jcsHash } from './jcs.js';

export class MandateBuilder {
  private specVersion: string;

  constructor(specVersion: string = '0.2.0') {
    this.specVersion = specVersion;
  }

  async build(options: {
    intentId: string;
    agent: string;
    agentScheme?: IdScheme;
    plan: string;
    bond?: string;
    feeQuote?: string;
    toolsDeclared?: string[];
    deadline: string;
    sign?: (hash: string) => Promise<string>;
  }): Promise<Mandate> {
    const planHash = await jcsHash(options.plan);

    const mandate: Mandate = {
      spec_version: this.specVersion,
      intent_id: options.intentId,
      agent: options.agent,
      agent_scheme: options.agentScheme || 'erc-8004',
      plan_hash: planHash,
      bond: options.bond || '0',
      fee_quote: options.feeQuote || '0',
      tools_declared: options.toolsDeclared || [],
      deadline: options.deadline,
      issued_at: new Date().toISOString(),
    };

    if (options.sign) {
      const forHash = { ...mandate };
      delete forHash.signature;
      const hash = await jcsHash(forHash);
      mandate.signature = await options.sign(hash);
    }

    return mandate;
  }

  async computePlanHash(plan: string): Promise<string> {
    return jcsHash(plan);
  }
}

export function verifyMandateSignature(mandate: Mandate): boolean {
  return mandate.signature !== undefined && mandate.signature.length > 0;
}
