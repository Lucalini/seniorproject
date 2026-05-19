import type { CityCommittee } from '../types'

export const CITY_COMMITTEES: CityCommittee[] = [
  {
    key: 'active-transportation-committee',
    name: 'Active Transportation Committee',
    shortName: 'ATC',
    description:
      'Provides oversight and policy decisions on matters related to bicycle and pedestrian transportation in the City of San Luis Obispo and its relationship to bicycling and walking outside the City. Meets the third Thursday of every other month (starting with January) at 6:00 p.m.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/active-transportation-committee',
    eventTitleMatchers: ['active transportation committee', 'active transportation', 'atc'],
  },
  {
    key: 'administrative-review-board',
    name: 'Administrative Review Board',
    shortName: 'ARB',
    description:
      'Hears appeals of administrative decisions made by City staff regarding building, zoning, and other regulatory matters. Provides an accessible forum for resolving disputes before they escalate to the City Council level.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/administrative-review-board',
    eventTitleMatchers: ['administrative review board', 'administrative review'],
  },
  {
    key: 'architectural-review-commission',
    name: 'Architectural Review Commission',
    shortName: 'ARC',
    description:
      'Establishes architectural guidelines and rules on the design of new construction and major commercial remodeling projects. Members must have a proven interest in the City\'s physical environment and the ability to make positive and fair aesthetic evaluations. Meets the first and third Monday of each month at 5:00 p.m.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/architectural-review-commission',
    eventTitleMatchers: ['architectural review commission', 'architectural review', 'arc meeting'],
  },
  {
    key: 'construction-board-of-appeals',
    name: 'Construction Board of Appeals',
    shortName: 'CBA',
    description:
      'Hears appeals related to the application of building codes and construction standards within the City. Provides a review process for decisions made by the building official regarding code compliance and construction permits.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/construction-board-of-appeals',
    eventTitleMatchers: ['construction board of appeals', 'construction board'],
  },
  {
    key: 'council-compensation-committee',
    name: 'Council Compensation Committee',
    shortName: 'CCC',
    description:
      'Reviews and makes recommendations regarding compensation for the Mayor and City Council members. Ensures that elected official compensation remains appropriate and competitive.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/council-compensation-committee',
    eventTitleMatchers: ['council compensation committee', 'council compensation'],
  },
  {
    key: 'cultural-heritage-committee',
    name: 'Cultural Heritage Committee',
    shortName: 'CHC',
    description:
      'Oversees a broad range of educational and technical assistance programs aimed at preserving historical and cultural resources. The program goal is preservation of historic and architecturally-significant buildings and locations. Meets the fourth Monday of each month at 5:30 p.m.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/cultural-heritage-committee',
    eventTitleMatchers: ['cultural heritage committee', 'cultural heritage', 'chc meeting'],
  },
  {
    key: 'dei-task-force',
    name: 'Diversity, Equity, Inclusion Task Force',
    shortName: 'DEI Task Force',
    description:
      'Advises the City Council on policies and programs that promote diversity, equity, and inclusion within the community. Works to ensure that City services and programs are accessible and equitable for all residents.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/dei-task-force',
    eventTitleMatchers: ['diversity equity inclusion', 'dei task force', 'dei meeting'],
  },
  {
    key: 'housing-authority-board',
    name: 'Housing Authority Board',
    shortName: 'Housing Authority',
    description:
      'Oversees the administration of affordable housing programs and public housing within the City. Works to expand housing opportunities for low-income residents and ensure compliance with federal and state housing regulations.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/housing-authority',
    eventTitleMatchers: ['housing authority board', 'housing authority'],
  },
  {
    key: 'human-relations-commission',
    name: 'Human Relations Commission',
    shortName: 'HRC',
    description:
      'Promotes positive human relations among all people in the City by fostering mutual respect and understanding. Advises the City Council on issues related to discrimination, civil rights, and community harmony.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/human-relations-commission',
    eventTitleMatchers: ['human relations commission', 'human relations', 'hrc meeting'],
  },
  {
    key: 'mass-transportation-committee',
    name: 'Mass Transportation Committee',
    shortName: 'MTC',
    description:
      'Advises the City Council on public transit issues including bus routes, schedules, fares, and transit planning. Works to improve public transportation services and accessibility for all residents.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/mass-transportation-committee',
    eventTitleMatchers: ['mass transportation committee', 'mass transportation', 'mtc meeting'],
  },
  {
    key: 'parks-and-recreation-commission',
    name: 'Parks and Recreation Commission',
    shortName: 'Parks & Rec',
    description:
      'Advises the City Council on matters related to parks, recreation facilities, open space, and recreational programs. Reviews park development plans and recommends policies for the maintenance and improvement of City parks.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/parks-and-recreation-commission',
    eventTitleMatchers: ['parks and recreation commission', 'parks and recreation', 'parks & recreation'],
  },
  {
    key: 'personnel-board',
    name: 'Personnel Board',
    shortName: 'Personnel Board',
    description:
      'Hears appeals from City employees regarding disciplinary actions and provides recommendations on personnel policies. Ensures fair and consistent application of employment rules and regulations.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/personnel-board',
    eventTitleMatchers: ['personnel board'],
  },
  {
    key: 'planning-commission',
    name: 'Planning Commission',
    shortName: 'Planning Commission',
    description:
      'Makes recommendations to the City Council for the City\'s development including the general plan, specific plans, capital improvement programs, and development review. Meets the second and fourth Wednesday of every month at 6:00 p.m.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/planning-commission',
    eventTitleMatchers: ['planning commission'],
  },
  {
    key: 'promotional-coordinating-committee',
    name: 'Promotional Coordinating Committee',
    shortName: 'PCC',
    description:
      'Coordinates promotional activities and special events within the City. Advises on marketing strategies and community events that enhance the economic vitality and cultural life of San Luis Obispo.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/promotional-coordinating-committee',
    eventTitleMatchers: ['promotional coordinating committee', 'promotional coordinating'],
  },
  {
    key: 'revenue-enhancement-oversight-commission',
    name: 'Revenue Enhancement Oversight Commission',
    shortName: 'REOC',
    description:
      'Provides independent oversight of revenue measures approved by voters. Reviews expenditures funded by local tax measures to ensure they are spent in accordance with voter intent and applicable regulations.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/revenue-enhancement-oversight-commission',
    eventTitleMatchers: ['revenue enhancement oversight', 'revenue enhancement', 'reoc'],
  },
  {
    key: 'tourism-business-improvement-district-board',
    name: 'Tourism Business Improvement District Board',
    shortName: 'TBID',
    description:
      'Oversees the Tourism Business Improvement District, which funds marketing and promotional activities to attract visitors to San Luis Obispo. Reviews and approves tourism marketing plans and budgets.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/tourism-business-improvement-district-board',
    eventTitleMatchers: ['tourism business improvement district', 'tbid'],
  },
  {
    key: 'tree-committee',
    name: 'Tree Committee',
    shortName: 'Tree Committee',
    description:
      'Advises the City Council on policies related to the planting, maintenance, and preservation of trees on public property. Reviews tree removal requests and promotes the urban forest as a community asset.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/tree-committee',
    eventTitleMatchers: ['tree committee'],
  },
  {
    key: 'investment-oversight-committee',
    name: 'Investment Oversight Committee',
    shortName: 'IOC',
    description:
      'Provides oversight of the City\'s investment portfolio and policies. Reviews investment performance and ensures that City funds are managed prudently in accordance with applicable laws and the City\'s investment policy.',
    committeeUrl: 'https://www.slocity.org/government/advisory-bodies/agendas-and-minutes/investment-oversight-committee',
    eventTitleMatchers: ['investment oversight committee', 'investment oversight'],
  },
]

export function eventMatchesCityCommitteeTitle(title: string, committee: CityCommittee) {
  const hay = title.toLowerCase()
  return committee.eventTitleMatchers.some((matcher) => hay.includes(matcher))
}
