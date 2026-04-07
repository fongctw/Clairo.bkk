// Hardcoded Bangkok public parks — reliable, instant, no API needed
// Coordinates are centroid lat/lng of each park

export interface ParkFeature {
  name: string
  nameTh: string
  type: string
  lat: number
  lng: number
  areaSqm?: number
  description?: string
}

export const BANGKOK_PARKS: ParkFeature[] = [
  { name: "Lumphini Park",            nameTh: "สวนลุมพินี",                   type: "Metropolitan Park", lat: 13.7311, lng: 100.5418, areaSqm: 570000, description: "Bangkok's most famous park, 57 ha of green space in the city center" },
  { name: "Benjakitti Park",          nameTh: "สวนเบญจกิติ",                  type: "Metropolitan Park", lat: 13.7222, lng: 100.5606, areaSqm: 450000, description: "Large park next to Queen Sirikit Convention Centre, scenic lake" },
  { name: "Benjakitti Forest Park",   nameTh: "สวนป่าเบญจกิติ",              type: "Forest Park",       lat: 13.7180, lng: 100.5680, areaSqm: 800000, description: "New forest extension of Benjakitti, elevated walkways" },
  { name: "Benjasiri Park",           nameTh: "สวนเบญจสิริ",                  type: "Urban Park",        lat: 13.7290, lng: 100.5690, areaSqm: 62000,  description: "Compact park in Sukhumvit area, popular for evening walks" },
  { name: "Chatuchak Park",           nameTh: "สวนจตุจักร",                   type: "Metropolitan Park", lat: 13.8017, lng: 100.5530, areaSqm: 290000, description: "Large park near Chatuchak Weekend Market and MRT" },
  { name: "Rot Fai Park (Chatuchak)", nameTh: "สวนรถไฟ (จตุจักร)",           type: "Urban Park",        lat: 13.7960, lng: 100.5620, areaSqm: 200000, description: "Railway park beside Chatuchak, great for cycling" },
  { name: "Suan Luang Rama IX",       nameTh: "สวนหลวง ร.9",                  type: "Royal Park",        lat: 13.7167, lng: 100.6333, areaSqm: 2000000, description: "Largest public park in Bangkok, 200 ha, botanical gardens" },
  { name: "Vachirabenjatas Park",     nameTh: "สวนวชิรเบญจทัศ",              type: "Metropolitan Park", lat: 13.7824, lng: 100.5800, areaSqm: 580000, description: "Known as Rot Fai Park (Dusit), large lake and cycle track" },
  { name: "Santiphap Park",           nameTh: "สวนสันติภาพ",                  type: "Urban Park",        lat: 13.7600, lng: 100.5200, areaSqm: 45000,  description: "Peace Park near Democracy Monument" },
  { name: "Romaneenart Park",         nameTh: "สวนรมณีนาถ",                   type: "Urban Park",        lat: 13.7470, lng: 100.5050, areaSqm: 47000,  description: "Former prison turned public park, Rattanakosin island" },
  { name: "Saranrom Park",            nameTh: "สวนสราญรมย์",                  type: "Royal Park",        lat: 13.7470, lng: 100.4960, areaSqm: 73000,  description: "Historic royal garden near Grand Palace" },
  { name: "Nong Bon Lake Park",       nameTh: "บึงหนองบอน",                   type: "Lake Park",         lat: 13.6920, lng: 100.6480, areaSqm: 500000, description: "Scenic lake park in eastern Bangkok" },
  { name: "Chulalongkorn University Centenary Park", nameTh: "อุทยาน 100 ปี จุฬาลงกรณ์", type: "University Park", lat: 13.7263, lng: 100.5286, areaSqm: 112000, description: "Modern urban park by Chulalongkorn University, green design" },
  { name: "Phutthabucha Park",        nameTh: "สวนพุทธบูชา",                  type: "Urban Park",        lat: 13.6730, lng: 100.5020, areaSqm: 80000,  description: "Large park in southern Bangkok, Bang Mot area" },
  { name: "Bang Kachao Green Area",   nameTh: "บางกะเจ้า",                    type: "Nature Reserve",    lat: 13.6550, lng: 100.5920, areaSqm: 12000000, description: "Bangkok's urban lung — peninsula across the river, cycling & nature" },
  { name: "Queen Sirikit Park",       nameTh: "สวนสมเด็จพระนางเจ้าสิริกิติ์", type: "Royal Park",       lat: 13.8060, lng: 100.5470, areaSqm: 220000, description: "Royal park in northern Bangkok near Chatuchak" },
  { name: "Sirikit Park (Khlong Toei)", nameTh: "สวนสิริกิติ์",              type: "Urban Park",        lat: 13.7200, lng: 100.5550, areaSqm: 55000,  description: "Small park near Khlong Toei" },
  { name: "Phramongkutklao Park",     nameTh: "สวนพระมงกุฎเกล้า",            type: "Urban Park",        lat: 13.7670, lng: 100.5340, areaSqm: 30000,  description: "Army-managed park open to public, Phaya Thai area" },
  { name: "Thung Song Hong Park",     nameTh: "สวนทุ่งสองห้อง",               type: "Urban Park",        lat: 13.8400, lng: 100.5650, areaSqm: 90000,  description: "Large park in northern Bangkok near Don Mueang" },
  { name: "Rama VIII Park",           nameTh: "สวนสาธารณะเฉลิมพระเกียรติ ร.8", type: "Urban Park",      lat: 13.7720, lng: 100.4950, areaSqm: 100000, description: "Park beside Chao Phraya river near Rama VIII bridge" },
  { name: "Lat Phrao Park",           nameTh: "สวนลาดพร้าว",                  type: "Urban Park",        lat: 13.8000, lng: 100.6100, areaSqm: 70000,  description: "Community park in Lat Phrao district" },
  { name: "Nonthaburi Park",          nameTh: "สวนสาธารณะนนทบุรี",            type: "Provincial Park",   lat: 13.8590, lng: 100.5140, areaSqm: 120000, description: "Riverside park in Nonthaburi province" },
]

// Convert to GeoJSON FeatureCollection (Point features for markers)
export function parksToGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: BANGKOK_PARKS.map((p, i) => ({
      type: "Feature",
      properties: {
        id: i,
        name: p.name,
        "name:th": p.nameTh,
        type: p.type,
        areaSqm: p.areaSqm,
        description: p.description,
      },
      geometry: {
        type: "Point",
        coordinates: [p.lng, p.lat],
      },
    })),
  };
}
