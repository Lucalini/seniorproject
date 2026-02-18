from __future__ import annotations

from geopy.exc import GeocoderServiceError, GeocoderTimedOut
from geopy.geocoders import Nominatim

_geolocator = Nominatim(user_agent="polislo-api")


def geocode_address(address: str) -> tuple[float, float]:
    """Return *(latitude, longitude)* for *address*.

    Swap this implementation to switch providers (e.g. Mapbox)
    without changing any calling code.

    Raises ``ValueError`` when the address cannot be resolved.
    """
    try:
        location = _geolocator.geocode(address, timeout=10)
    except (GeocoderTimedOut, GeocoderServiceError) as exc:
        raise ValueError(f"Geocoding service error: {exc}") from exc
    if location is None:
        raise ValueError(f"Could not geocode address: {address!r}")
    return (location.latitude, location.longitude)
