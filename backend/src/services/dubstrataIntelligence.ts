import logger from '../utils/logger.js';
import type { MarketState } from './agentDecision.js';

const DUBSTRATA_BASE_URL = 'https://api.dubstrata.com/api/v1';
const DUBSTRATA_API_KEY = process.env.DUBSTRATA_API_KEY || '';

interface DubstrataPriceAction {
  ticker: string;
  price?: number;
  change_24h_percent?: number | null;
  return_1m_percent?: number;
  return_6m_percent?: number;
  return_1y_percent?: number;
  historical_volatility_40d?: number;
  altman_z_score?: number;
}

interface DubstrataClaim {
  argument: string;
  evidence: string;
  source_url: string;
  similarity_score: number;
}

interface DubstrataQueryResult {
  status: string;
  remaining_balance: number;
  execution_cost: number;
  aggregate_sentiment_score?: number;
  structured_result?: {
    price_action?: DubstrataPriceAction[];
    claims?: DubstrataClaim[];
  };
}

export interface DubstrataSignal {
  ticker: string;
  price: number;
  volatility: number;
  oneMonthReturn: number;
  sentimentScore: number;
  signalStrength: 'strong' | 'moderate' | 'weak';
}

export class DubstrataIntelligenceService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = DUBSTRATA_API_KEY;
    this.baseUrl = DUBSTRATA_BASE_URL;
  }

  async queryMarketIntelligence(query: string): Promise<DubstrataQueryResult | null> {
    if (!this.apiKey) {
      logger.warn('DUBSTRATA_API_KEY not set, skipping Dubstrata intelligence');
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, is_private: false }),
        signal: AbortSignal.timeout(15000),
      });
      const data: DubstrataQueryResult = await response.json();
      return data;
    } catch (err) {
      logger.debug('Dubstrata query failed', { error: String(err) });
      return null;
    }
  }

  async enrichMarketState(state: MarketState): Promise<MarketState> {
    const enriched = { ...state };
    const tokens = Object.keys(state.prices);

    for (const token of tokens) {
      const result = await this.queryMarketIntelligence(
        `Analyze ${token} price action, volatility, and market sentiment`,
      );
      if (!result?.structured_result?.price_action) continue;

      const pa = result.structured_result.price_action.find(
        (p: DubstrataPriceAction) => p.ticker === token,
      );
      if (pa?.price && pa.price > 0) {
        enriched.prices[token] = pa.price;
      }
    }

    return enriched;
  }

  async getMarketSignals(): Promise<DubstrataSignal[]> {
    const signals: DubstrataSignal[] = [];
    const tickers = ['ETH', 'BTC', 'SOL', 'LINK', 'UNI', 'AAVE', 'ARB'];

    for (const ticker of tickers) {
      const result = await this.queryMarketIntelligence(
        `Analyze ${ticker} price, volatility, and market sentiment`,
      );
      if (!result?.structured_result?.price_action) continue;

      for (const pa of result.structured_result.price_action) {
        if (pa.ticker !== ticker) continue;
        const vol = pa.historical_volatility_40d || 0;
        const oneMReturn = pa.return_1m_percent || 0;
        let signalStrength: 'strong' | 'moderate' | 'weak' = 'weak';
        if (vol > 50 && Math.abs(oneMReturn) > 10) signalStrength = 'strong';
        else if (vol > 30 || Math.abs(oneMReturn) > 5) signalStrength = 'moderate';

        signals.push({
          ticker,
          price: pa.price || 0,
          volatility: vol,
          oneMonthReturn: oneMReturn,
          sentimentScore: result.aggregate_sentiment_score || 0,
          signalStrength,
        });
      }
    }

    return signals;
  }
}

export const dubstrataIntelligence = new DubstrataIntelligenceService();
