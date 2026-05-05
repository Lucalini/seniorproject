import { Link } from 'react-router-dom'
import { ASI_COMMITTEES } from '../data/asiCommittees'

export function ASIPage() {
  return (
    <div className="asiPage">
      <div className="asiHeader">
        <div>
          <h1 className="pageTitle">ASI</h1>
          <p className="pageSubtitle">Choose a committee to view its meetings, description, and tracking options.</p>
        </div>
        <Link to="/events" className="button buttonSecondary">
          Main calendar
        </Link>
      </div>

      <div className="asiCommitteeGrid">
        {ASI_COMMITTEES.map((committee) => (
          <Link key={committee.key} to={`/asi/${committee.key}`} className="asiCommitteeSquare">
            <span>{committee.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
