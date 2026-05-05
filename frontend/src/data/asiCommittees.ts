import type { ASICommittee } from '../types'

export const ASI_COMMITTEES: ASICommittee[] = [
  {
    key: 'asi-executive-cabinet',
    name: 'ASI Executive Cabinet',
    shortName: 'Executive Cabinet',
    description:
      "The ASI president and chief of staff oversee the Executive Cabinet, which works with student volunteers, ASI staff, and community members to carry out the president's goals. Elected in the annual spring ASI elections, the ASI president works with university, city, and state leaders to represent student interests at every level.",
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/executive-cabinet/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/asi-executive-cabinet/?recurrence=20260508',
    eventTitleMatchers: ['asi executive cabinet', 'executive cabinet'],
  },
  {
    key: 'asi-board-of-directors',
    name: 'ASI Board of Directors',
    shortName: 'Board of Directors',
    description:
      'The official voice of Cal Poly students. Student-elected representatives from each academic college serve on the Board of Directors. Their responsibilities range from oversight of ASI corporate activity to representing and advocating on behalf of students.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/board-of-directors/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/asi-board-of-directors-workshop/?recurrence=20260511',
    eventTitleMatchers: ['asi board of directors', 'board of directors workshop', 'board of directors meeting'],
  },
  {
    key: 'university-union-advisory-board',
    name: 'University Union Advisory Board',
    shortName: 'UUAB',
    description:
      'The University Union Advisory Board makes policy recommendations for ASI-managed facilities, including the Cal Poly Recreation Center, Julian A. McPhee University Union, Cal Poly Sports Complex, Doerr Family Field, and The Forum, while working to maintain the integrity of the University Union student body fee.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/uuab/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/university-union-advisory-board-uuab-meeting/?recurrence=20260505',
    eventTitleMatchers: ['university union advisory board', 'uuab'],
  },
  {
    key: 'asi-business-finance',
    name: 'ASI Business & Finance Committee',
    shortName: 'Business & Finance',
    description:
      'Responsible for issues relating to all corporate finance and personnel matters. The specific operations of this committee in regard to personnel matters are carried out in accordance with the ASI Personnel Policy Manual. This committee reviews the ASI budget, recommends personnel and human resources changes to the Board of Directors, and provides fiscal insight to the club funding liaisons regarding ASI Club Funding.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-business-finance/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/business-finance-meeting_s26/',
    eventTitleMatchers: ['business & finance', 'business and finance', 'finance committee'],
  },
  {
    key: 'asi-uu-internal-review',
    name: 'ASI/UU Internal Review Committee',
    shortName: 'Internal Review',
    description:
      'Responsible for reviewing and making recommendations to the board on ASI Club Funding Policies, independent auditor service proposals and audit firm selection, ASI Audit, Corporate Risk Management and Insurance Plans, ASI Bylaws, and policy additions or modifications.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-uu-internal-review-committee/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/internal-review-committee-s26/',
    eventTitleMatchers: ['internal review committee', 'asi/uu internal review'],
  },
  {
    key: 'asi-external-affairs',
    name: 'ASI External Affairs Committee',
    shortName: 'External Affairs',
    description:
      'Responsible for representing, serving, and addressing student concerns before local, state, and federal legislature. The committee recommends whether to support or oppose pending legislation concerning Cal Poly students or the California State University system, communicates lobbying efforts, researches legislation, reports issues to the board, and builds long-term relationships between ASI and city, county, and state representatives.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-external-affairs/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/asi-external-affairs-committee/',
    eventTitleMatchers: ['external affairs committee', 'asi external affairs'],
  },
  {
    key: 'asi-recruitment-elections',
    name: 'ASI Recruitment & Elections Committee',
    shortName: 'Recruitment & Elections',
    description:
      'This committee is responsible for the effective recruitment of candidates to serve in every branch of Student Government in addition to ASI Leadership Team positions. The committee develops and recommends election regulations for board approval, supervises all ASI elections, and reports election results to the board in accordance with the ASI Election Code.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-recruitment-elections-committee/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/asi-recruitment-elections-committee/',
    eventTitleMatchers: ['recruitment & elections', 'recruitment and elections', 'elections committee'],
  },
  {
    key: 'asi-deij',
    name: 'ASI Diversity, Equity, Inclusion, & Justice Committee',
    shortName: 'DEIJ',
    description:
      'Responsible for ensuring Student Government serves as an inclusive environment that addresses the needs and concerns of underrepresented minority students. The committee may recommend inclusive language and consideration of student intersectionality within endorsements, resolutions, and bills, hosts town halls for student feedback, and applies diversity, equity, inclusion, and allyship training across Student Government work.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/committees/asi-diversity-inclusion/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/asi-diversity-equity-integrity-justice-committee/',
    eventTitleMatchers: ['diversity equity', 'inclusion', 'justice committee', 'deij'],
  },
  {
    key: 'student-community-liaison',
    name: 'Student Community Liaison Committee',
    shortName: 'SCLC',
    description:
      'The Student Community Liaison Committee serves as a mechanism of communication among Cal Poly, Cuesta College, the City and County of San Luis Obispo, and community organizations. Its mission is to proactively engage in discussions that promote positive relations, mutual respect, and improved quality of life for all citizens of San Luis Obispo.',
    committeeUrl: 'https://www.asi.calpoly.edu/get-involved/student-government/student-community-liaison-committee/',
    eventSourceUrl: 'https://www.asi.calpoly.edu/events/student-community-liaison-committee-7/?recurrence=20260515',
    eventTitleMatchers: ['student community liaison', 'sclc'],
  },
]

export function eventMatchesCommitteeTitle(title: string, committee: ASICommittee) {
  const hay = title.toLowerCase()
  return committee.eventTitleMatchers.some((matcher) => hay.includes(matcher))
}
