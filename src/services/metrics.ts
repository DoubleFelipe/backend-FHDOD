import { withClient } from '../utils/database.js';
import * as model from '../models/metrics.js';
import { type Principal } from '../infrastructure/auth.js';
import { average, calculateNps, satisfaction } from '../domain/metrics.js';
import { assertSectorAccess } from './access.js';
import { type MetricsQuery } from '../validators/report.js';
export async function dashboard(principal: Principal, query: MetricsQuery) {
  return withClient(async (client) => {
    if (query.sectorId) await assertSectorAccess(client, principal, query.sectorId);
    const params: model.MetricsParameters = [
      principal.id,
      ['admin', 'ombudsman'].includes(principal.role),
      query.sectorId ?? null,
      query.from ?? null,
      query.to ?? null,
      query.shift ?? null,
    ];
    const rows = await model.findResponses(params, client);
    const ratings = await model.findRatings(params, client);
    const scores = rows.rows.map((row) => Number(row.nps));
    const ratingScores = ratings.rows.map((row) => Number(row.value));
    const promoters = scores.filter((score) => score >= 9).length;
    const detractors = scores.filter((score) => score <= 6).length;
    const sectorMap = new Map<
      string,
      { id: string; name: string; npsScores: number[]; ratings: number[] }
    >();
    for (const row of rows.rows) {
      const entry: { id: string; name: string; npsScores: number[]; ratings: number[] } =
        sectorMap.get(row.sector_id) ?? {
          id: String(row.sector_id),
          name: String(row.sector_name),
          npsScores: [],
          ratings: [],
        };
      entry.npsScores.push(Number(row.nps));
      sectorMap.set(row.sector_id, entry);
    }
    for (const row of ratings.rows) {
      const entry = sectorMap.get(row.sector_id);
      if (entry) entry.ratings.push(Number(row.value));
    }
    return {
      total: scores.length,
      count: scores.length,
      nps: calculateNps(scores),
      average: average(ratingScores),
      averageNpsScore: average(scores),
      satisfaction: satisfaction(ratingScores),
      satisfactionPercent: satisfaction(ratingScores),
      promoters,
      passives: scores.filter((score) => score >= 7 && score <= 8).length,
      detractors,
      ratings: ratingScores.length,
      distribution: [1, 2, 3, 4, 5].map((value) => ({
        value,
        count: ratingScores.filter((score) => score === value).length,
      })),
      sectors: [...sectorMap.values()].map((sector) => ({
        id: sector.id,
        name: sector.name,
        total: sector.npsScores.length,
        nps: calculateNps(sector.npsScores),
        average: average(sector.ratings),
      })),
    };
  });
}

export async function publicMetrics() {
  const responses = await model.findPublicResponses();
  const ratings = await model.findPublicRatings();
  const nps = responses.rows.map((row) => Number(row.nps));
  const values = ratings.rows.map((row) => Number(row.value));
  return {
    total: nps.length,
    nps: calculateNps(nps),
    average: average(values),
    satisfaction: satisfaction(values),
    promoters: nps.filter((v) => v >= 9).length,
    passives: nps.filter((v) => v >= 7 && v <= 8).length,
    detractors: nps.filter((v) => v <= 6).length,
    ratings: values.length,
    distribution: [1, 2, 3, 4, 5].map((value) => ({
      value,
      count: values.filter((v) => v === value).length,
    })),
    sectors: [],
  };
}
