import type { EducationTopic, NewsArticle } from '../types'

export const NEWS_SEED: NewsArticle[] = [
  {
    id: 'example-1',
    title: 'Example: Local housing policy update (replace with real feed)',
    source: 'Prototype',
    url: 'https://www.slocounty.ca.gov/',
    publishedAt: '2026-01-01T16:00:00.000Z',
    summary: 'This is placeholder content to validate your UI + API contract.',
    tags: ['housing', 'county'],
    relatedOfficialIds: ['slo-county-bos-d1'],
  },
  {
    id: 'example-2',
    title: 'Example: City council agenda posted (replace with real feed)',
    source: 'Prototype',
    url: 'https://www.slocity.org/',
    publishedAt: '2025-12-31T22:00:00.000Z',
    summary: 'Next step: ingest agendas/minutes and link them to events + officials.',
    tags: ['city', 'agenda'],
    relatedOfficialIds: ['slo-city-council'],
  },
]

export const EDUCATION_SEED: EducationTopic[] = [
  {
    id: 'how-local-government-works',
    title: 'How city & county government works',
    description: 'A quick mental model for what decisions get made where.',
    bullets: [
      'City councils: land use, local ordinances, budgets, city services.',
      'County supervisors: unincorporated areas, countywide services, public health.',
      'Planning commissions: recommendations on development + zoning.',
      'Special districts: water, fire, transit, etc. (often elected boards).',
    ],
  },
  {
    id: 'how-to-create-change',
    title: 'Practical strategies to create change',
    description: "Tactics that work even if you're new to local politics.",
    bullets: [
      'Show up: comment at meetings (in-person or Zoom) and follow up in writing.',
      'Organize: petitions, phone banking, canvassing, mutual aid, coalitions.',
      'Track power: budgets, commissions, endorsements, and decision timelines.',
      'Make it easy: share summaries + links so others can act quickly.',
    ],
  },
  {
    id: 'issues-and-topics',
    title: 'Issues & topics',
    description: 'This section can evolve into explainers for SLO-specific topics.',
    bullets: [
      'Housing & zoning',
      'Water, climate, and resilience',
      'Public safety & jail policy',
      'Transportation, biking, and transit',
      'Education and school boards',
    ],
  },
]
