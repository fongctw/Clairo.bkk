// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirQualityData {
  pm25: number | null
  aqi: number | null
  station: string
  stationLat: number | null
  stationLng: number | null
}

export interface WeatherData {
  temp: number
  humidity: number
  wind: number
  feels_like: number
}

export interface LocationData {
  district: string
  area: string
  city: string
}

export interface Pm25Station {
  id: string
  name: string
  lat: number
  lng: number
  pm25: number | null
  aqi: number | null
}

export type SafetyLevel = 'Safe' | 'Moderate' | 'Unhealthy' | 'Dangerous' | 'Unknown'

export interface SafetyInfo {
  level: SafetyLevel
  color: string
  emoji: string
  message: string
  messageTh: string
}

// ─── Safety level ─────────────────────────────────────────────────────────────

export const getSafetyInfo = (pm25: number | null): SafetyInfo => {
  if (pm25 === null || pm25 === undefined)
    return { level: 'Unknown', color: '#9ca3af', emoji: '❓', message: 'No data available', messageTh: 'ไม่มีข้อมูล' }
  if (pm25 <= 25)
    return { level: 'Safe', color: '#16a34a', emoji: '🟢', message: 'Good air — great time to visit!', messageTh: 'อากาศดี เหมาะกับการออกกำลังกาย' }
  if (pm25 <= 50)
    return { level: 'Moderate', color: '#d97706', emoji: '🟡', message: 'Acceptable — sensitive groups take care', messageTh: 'ควรระวังหากมีโรคระบบทางเดินหายใจ' }
  if (pm25 <= 100)
    return { level: 'Unhealthy', color: '#dc2626', emoji: '🔴', message: 'Unhealthy — consider wearing a mask', messageTh: 'ควรสวมหน้ากากอนามัย' }
  return { level: 'Dangerous', color: '#7c3aed', emoji: '🟣', message: 'Dangerous — avoid outdoor activity', messageTh: 'หลีกเลี่ยงกิจกรรมกลางแจ้ง' }
}

// ─── Air quality at a point ───────────────────────────────────────────────────

export const fetchAirQuality = async (lat: number, lng: number): Promise<AirQualityData> => {
  const token = process.env.NEXT_PUBLIC_AQICN_TOKEN
  const res = await fetch(`https://api.waqi.info/feed/geo:${lat};${lng}/?token=${token}`)
  const data = await res.json()
  const geo = data.data?.city?.geo
  const rawPm25 = data.data?.iaqi?.pm25?.v ?? null
  return {
    // iaqi.pm25.v is the PM2.5 AQI sub-index (0–500), not µg/m³ — convert it
    pm25: rawPm25 !== null ? aqiToPm25(rawPm25) : null,
    aqi: data.data?.aqi ?? null,
    station: data.data?.city?.name ?? 'Unknown station',
    stationLat: Array.isArray(geo) ? geo[0] : null,
    stationLng: Array.isArray(geo) ? geo[1] : null,
  }
}

// ─── All PM2.5 stations in Bangkok bounding box ───────────────────────────────

const SENSOR_BBOX = '13.40,100.20,14.20,101.00'  // wider — covers Rangsit, outer provinces

export const fetchPm25Stations = async (): Promise<Pm25Station[]> => {
  try {
    const token = process.env.NEXT_PUBLIC_AQICN_TOKEN
    const [s, w, n, e] = SENSOR_BBOX.split(',')
    const res = await fetch(
      `https://api.waqi.info/map/bounds/?latlng=${s},${w},${n},${e}&token=${token}`
    )
    const data = await res.json()
    if (data.status !== 'ok' || !Array.isArray(data.data)) return []
    return data.data
      .filter((s: { aqi: unknown }) => s.aqi !== '-' && s.aqi !== undefined)
      .map((s: { uid: number; station: { name: string }; lat: number; lon: number; aqi: string | number }) => ({
        id: String(s.uid),
        name: s.station?.name ?? 'Unknown',
        lat: s.lat,
        lng: s.lon,
        aqi: typeof s.aqi === 'number' ? s.aqi : parseInt(String(s.aqi)) || null,
        pm25: null, // bounds API returns AQI only; we map AQI→approx PM2.5
      }))
      .map((s: Pm25Station & { aqi: number | null }) => ({
        ...s,
        pm25: s.aqi !== null ? aqiToPm25(s.aqi) : null,
      }))
  } catch {
    return []
  }
}

// AQI ↔ PM2.5 conversions (US EPA linear breakpoints)
function aqiToPm25(aqi: number): number {
  if (aqi <= 50)  return Math.round((aqi / 50) * 12)
  if (aqi <= 100) return Math.round(12 + ((aqi - 50) / 50) * (35.4 - 12))
  if (aqi <= 150) return Math.round(35.4 + ((aqi - 100) / 50) * (55.4 - 35.4))
  if (aqi <= 200) return Math.round(55.4 + ((aqi - 150) / 50) * (150.4 - 55.4))
  return Math.round(150.4 + ((aqi - 200) / 100) * (250.4 - 150.4))
}

// PM2.5 µg/m³ → US EPA AQI (for display alongside raw concentration)
export function pm25ToAqi(pm25: number): number {
  if (pm25 <= 12)    return Math.round((pm25 / 12) * 50)
  if (pm25 <= 35.4)  return Math.round(50  + ((pm25 - 12)    / (35.4 - 12))    * 50)
  if (pm25 <= 55.4)  return Math.round(100 + ((pm25 - 35.4)  / (55.4 - 35.4))  * 50)
  if (pm25 <= 150.4) return Math.round(150 + ((pm25 - 55.4)  / (150.4 - 55.4)) * 50)
  if (pm25 <= 250.4) return Math.round(200 + ((pm25 - 150.4) / (250.4 - 150.4)) * 100)
  return Math.round(300 + ((pm25 - 250.4) / (500.4 - 250.4)) * 200)
}

// ─── Weather forecast ─────────────────────────────────────────────────────────

export interface ForecastSlot {
  time: string      // e.g. "14:00"
  date: string      // e.g. "Fri 4 Apr"
  temp: number
  feels_like: number
  description: string
  icon: string      // OWM icon code e.g. "02d"
  pop: number       // probability of precipitation 0–1
  wind: number
  humidity: number
}

export const fetchForecast = async (lat: number, lng: number): Promise<ForecastSlot[]> => {
  try {
    const key = process.env.NEXT_PUBLIC_OWM_KEY
    if (!key || key === 'your_openweathermap_key_here') return []
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${key}&units=metric&cnt=8`
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!data.list) return []
    return data.list.map((item: {
      dt_txt: string
      main: { temp: number; feels_like: number; humidity: number }
      weather: { description: string; icon: string }[]
      pop: number
      wind: { speed: number }
    }) => {
      const dt = new Date(item.dt_txt.replace(' ', 'T') + 'Z')
      return {
        time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
        date: dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }),
        temp: Math.round(item.main.temp),
        feels_like: Math.round(item.main.feels_like),
        description: item.weather[0]?.description ?? '',
        icon: item.weather[0]?.icon ?? '01d',
        pop: Math.round(item.pop * 100),
        wind: item.wind?.speed ?? 0,
        humidity: item.main.humidity,
      }
    })
  } catch {
    return []
  }
}

// ─── Weather (current) ────────────────────────────────────────────────────────

export const fetchWeather = async (lat: number, lng: number): Promise<WeatherData | null> => {
  try {
    const key = process.env.NEXT_PUBLIC_OWM_KEY
    if (!key || key === 'your_openweathermap_key_here') return null
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.main) return null
    return {
      temp: data.main.temp,
      humidity: data.main.humidity,
      wind: data.wind?.speed ?? 0,
      feels_like: data.main.feels_like,
    }
  } catch {
    return null
  }
}

// ─── Parks — loaded from Overpass GeoJSON file ────────────────────────────────

export const fetchParks = async (): Promise<GeoJSON.FeatureCollection> => {
  const res = await fetch('/park.geojson')
  if (!res.ok) throw new Error('Failed to load parks GeoJSON')
  return res.json()
}

// ─── BMA (Greener Bangkok) API ────────────────────────────────────────────────

// Amenity category ID → icon + label
const BMA_CATEGORIES: Record<number, { icon: string; label: string }> = {
  116: { icon: '🚣', label: 'Pedal Boating' },
  118: { icon: '🏀', label: 'Basketball' },
  35:  { icon: '🚴', label: 'Cycling' },
  36:  { icon: '🏋️', label: 'Fitness' },
  30:  { icon: '🅿️', label: 'Parking' },
  119: { icon: '🚻', label: 'Restroom' },
  31:  { icon: '🚌', label: 'Bus Access' },
  29:  { icon: '🚇', label: 'BTS/MRT' },
  33:  { icon: '♿', label: 'Accessible' },
  221: { icon: '🛹', label: 'Skateboard' },
  120: { icon: '🏃', label: 'Running Track' },
  24:  { icon: '🛝', label: 'Playground' },
  25:  { icon: '🏊', label: 'Swimming Pool' },
  27:  { icon: '🐾', label: 'Pet Friendly' },
  117: { icon: '🏸', label: 'Badminton' },
  34:  { icon: '🦮', label: 'Guide Dogs' },
}

export interface BMACategory {
  icon: string
  label: string
}

export interface BMAPark {
  id: number
  slug: string
  nameTh: string
  link: string
  image: string | null
  categories: BMACategory[]
  districtId: number | null
  districtName: string
}

// District ID → Thai name mapping (from /wp-json/wp/v2/district)
const DISTRICT_NAMES: Record<number, string> = {
  71: 'เขตบางพลัด', 78: 'เขตประเวศ', 251: 'เขตคลองเตย',
  252: 'เขตจตุจักร', 253: 'เขตดอนเมือง', 254: 'เขตทวีวัฒนา',
  255: 'เขตทุ่งครุ', 256: 'เขตบางเขน', 257: 'เขตบางแค',
  258: 'เขตบางขุนเทียน', 259: 'เขตบางคอแหลม', 260: 'เขตบางบอน',
  261: 'เขตบางพลัด', 262: 'เขตบึงกุ่ม', 263: 'เขตปทุมวัน',
  264: 'เขตประเวศ', 272: 'เขตบางกะปิ',
}

export const fetchBMAParks = async (): Promise<BMAPark[]> => {
  try {
    const res = await fetch('/parks_clean.json')
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []

    return data.map((p: {
      id: number
      slug: string
      name: string
      link: string
      district: { id: number; name: string; slug: string }
      categories: { id: number; name: string; slug: string }[]
      image: string
    }) => ({
      id: p.id,
      slug: p.slug,
      nameTh: p.name ?? '',
      link: p.link ?? '',
      image: p.image ?? null,
      categories: (p.categories ?? [])
        .map((c) => BMA_CATEGORIES[c.id])
        .filter(Boolean),
      districtId: p.district?.id ?? null,
      districtName: p.district?.name ?? '',
    }))
  } catch {
    return []
  }
}

// Normalize Thai park name for fuzzy matching
// Strips common prefix words so e.g. "สวนลุมพินี" matches "ลุมพินี"
function normalizeThai(name: string): string {
  return name
    .replace(/^(สวน|สวนสาธารณะ|สวนป่า|อุทยาน|บึง|ลาน|สนาม)/u, '')
    .replace(/[()（）]/g, '')
    .trim()
}

export interface EnrichedPark {
  // BMA official data
  id: number
  slug: string
  nameTh: string
  nameEn: string
  description: string
  openHours: string
  image: string | null
  categories: BMACategory[]
  district: string
  link: string
  // Geometry (from GeoJSON)
  centroid: [number, number] | null
  polygon: GeoJSON.Feature | null
}

export const fetchEnrichedParks = async (): Promise<EnrichedPark[]> => {
  try {
    const { BMA_META_BY_SLUG } = await import('./bma-parks-meta')
    const [bmaParks, geojson] = await Promise.all([
      fetchBMAParks(),
      fetchParks().catch(() => null),
    ])

    const osmFeatures = geojson?.features ?? []

    return bmaParks.map((bma) => {
      const meta = BMA_META_BY_SLUG[bma.slug]
      const normalizedBma = normalizeThai(bma.nameTh)

      // Match OSM polygon by Thai name fuzzy matching
      const matched = osmFeatures.find((f) => {
        const osmName: string = f.properties?.name ?? ''
        const normalizedOsm = normalizeThai(osmName)
        return (
          osmName === bma.nameTh ||
          normalizedOsm === normalizedBma ||
          normalizedOsm.includes(normalizedBma) ||
          normalizedBma.includes(normalizedOsm)
        )
      }) ?? null

      // Compute centroid from matched polygon
      let centroid: [number, number] | null = null
      if (matched) {
        const g = matched.geometry
        if (g.type === 'Point') {
          centroid = [g.coordinates[1], g.coordinates[0]]
        } else if (g.type === 'Polygon') {
          const ring = g.coordinates[0]
          centroid = [
            ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length,
            ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length,
          ]
        } else if (g.type === 'MultiPolygon') {
          const ring = g.coordinates[0][0]
          centroid = [
            ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length,
            ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length,
          ]
        }
      }

      return {
        id: bma.id,
        slug: bma.slug,
        nameTh: bma.nameTh,
        nameEn: meta?.nameEn ?? bma.slug.replace(/-/g, ' '),
        description: meta?.description ?? '',
        openHours: meta?.openHours ?? '',
        image: bma.image,
        categories: bma.categories,
        district: bma.districtName || (bma.districtId ? (DISTRICT_NAMES[bma.districtId] ?? '') : ''),
        link: bma.link,
        centroid,
        polygon: matched,
      }
    })
  } catch {
    return []
  }
}

// ─── IDW interpolation ────────────────────────────────────────────────────────

export interface IdwResult {
  pm25: number
  stationsUsed: number
  nearestStation: string
  nearestDistM: number
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function idwPm25(lat: number, lng: number, stations: Pm25Station[], maxKm = 15, power = 2): IdwResult | null {
  const candidates = stations
    .filter((s) => s.pm25 !== null)
    .map((s) => ({ ...s, distM: haversineM(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distM <= maxKm * 1000)
    .sort((a, b) => a.distM - b.distM)

  if (candidates.length === 0) return null

  if (candidates[0].distM < 10) {
    return { pm25: candidates[0].pm25!, stationsUsed: 1, nearestStation: candidates[0].name, nearestDistM: Math.round(candidates[0].distM) }
  }

  let weightedSum = 0, weightTotal = 0
  for (const s of candidates) {
    const w = 1 / Math.pow(s.distM, power)
    weightedSum += s.pm25! * w
    weightTotal += w
  }

  return {
    pm25: Math.round((weightedSum / weightTotal) * 10) / 10,
    stationsUsed: candidates.length,
    nearestStation: candidates[0].name,
    nearestDistM: Math.round(candidates[0].distM),
  }
}

// ─── Historical PM2.5 — Open-Meteo Air Quality API (free, no key) ────────────
// Returns daily average PM2.5 for the past 7 days at a given location
// Source: CAMS European air quality reanalysis model

export interface Pm25Day {
  date: string   // e.g. "Mon 31 Mar"
  pm25: number   // daily average µg/m³
}

export const fetchPm25History = async (lat: number, lng: number): Promise<Pm25Day[]> => {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm2_5&past_days=7&forecast_days=1&timezone=Asia%2FBangkok`
    )
    if (!res.ok) return []
    const data = await res.json()
    const times: string[]  = data.hourly?.time  ?? []
    const values: number[] = data.hourly?.pm2_5 ?? []

    // Group hourly values by date, compute daily average
    const byDate: Record<string, number[]> = {}
    times.forEach((t, i) => {
      if (values[i] === null || values[i] === undefined) return
      const date = t.split('T')[0]  // "2024-04-01"
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(values[i])
    })

    return Object.entries(byDate)
      .slice(0, 7)  // last 7 days only
      .map(([dateStr, vals]) => {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length
        const dt = new Date(dateStr + 'T12:00:00+07:00')
        return {
          date: dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          pm25: Math.round(avg * 10) / 10,
        }
      })
  } catch {
    return []
  }
}

// ─── Reverse geocoding ────────────────────────────────────────────────────────

export const reverseGeocode = async (lat: number, lng: number): Promise<LocationData> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
    { headers: { 'User-Agent': 'BangkokGreenApp/1.0' } }
  )
  const data = await res.json()
  return {
    district: data.address?.suburb || data.address?.quarter || data.address?.neighbourhood || '',
    area: data.address?.city_district || '',
    city: data.address?.city || 'Bangkok',
  }
}
