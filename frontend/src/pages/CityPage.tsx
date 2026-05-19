import { Link } from 'react-router-dom'
import { CITY_COMMITTEES } from '../data/cityCommittees'

export function CityPage() {
  return (
    <div className="asiPage">
      <div className="asiHeader">
        <div>
          <h1 className="pageTitle">City of SLO</h1>
          <p className="pageSubtitle">Choose an advisory body to view its meetings, description, and tracking options.</p>
        </div>
        <Link to="/events" className="button buttonSecondary">
          Main calendar
        </Link>
      </div>

      <div className="asiCommitteeGrid">
        {CITY_COMMITTEES.map((committee) => (
          <Link key={committee.key} to={`/city/${committee.key}`} className="asiCommitteeSquare">
            <span>{committee.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
