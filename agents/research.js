// ═══════════════════════════════════════════════════
// agents/research.js
// Runs daily at 6am. Finds 20 new leads per country.
// ═══════════════════════════════════════════════════

const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:         String,
  country:      String,
  city:         String,
  category:     String,
  whatsapp:     String,
  phone:        String,
  website:      String,
  instagram:    String,
  rating:       Number,
  review_count: Number,
  score:        Number,
  status:       { type: String, default: 'new', enum: ['new','contacted','interested','trial','paying','not_now'] },
  outreach_date: Date,
  reply_date:    Date,
  trial_start:   Date,
  conversion_date: Date,
  mrr:           { type: Number, default: 0 },
  messages_handled: { type: Number, default: 0 },
  notes:         String,
  found_at:      { type: Date, default: Date.now },
});

// Export model (check if already compiled to avoid errors)
const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);

const CATEGORIES = ['lodging', 'tourist_attraction', 'travel_agency', 'spa', 'amusement_park'];

const CITY_MAP = {
  Albania:    ['Saranda', 'Berat', 'Theth', 'Ksamil', 'Gjirokaster', 'Vlore', 'Tirana'],
  Montenegro: ['Kotor', 'Budva', 'Tivat', 'Herceg Novi', 'Podgorica'],
  Brazil:     ['Rio de Janeiro', 'Florianopolis', 'Paraty', 'Buzios'],
  Georgia:    ['Tbilisi', 'Batumi', 'Gudauri'],
  Turkey:     ['Antalya', 'Istanbul', 'Bodrum', 'Cappadocia'],
};

async function searchGoogleMaps(city, category) {
  const key  = process.env.GOOGLE_MAPS_API_KEY;
  const url  = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(category + ' in ' + city)}&key=${key}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

async function getPlaceDetails(placeId) {
  const key    = process.env.GOOGLE_MAPS_API_KEY;
  const fields = 'name,formatted_phone_number,website,rating,user_ratings_total';
  const url    = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${key}`;
  const res    = await fetch(url);
  const data   = await res.json();
  return data.result || {};
}

function scoreLead(place) {
  let score = 50;
  if (place.rating >= 4.5)            score += 20;
  else if (place.rating >= 4.0)       score += 10;
  if (place.user_ratings_total > 100) score += 15;
  if (place.website)                  score += 10;
  if (place.formatted_phone_number)   score += 5;
  return Math.min(score, 99);
}

async function runResearchAgent() {
  console.log('[Research] Starting daily lead scan...');
  let totalNew = 0;

  for (const [country, cities] of Object.entries(CITY_MAP)) {
    for (const city of cities) {
      for (const category of CATEGORIES.slice(0, 2)) { // limit to 2 categories/city
        try {
          const results = await searchGoogleMaps(city, category);

          for (const place of results.slice(0, 5)) {
            // Check if already in DB
            const exists = await Lead.findOne({ name: place.name, city });
            if (exists) continue;

            const details = await getPlaceDetails(place.place_id);
            const score   = scoreLead({ ...place, ...details });

            await Lead.create({
              name:         place.name,
              country,
              city,
              category,
              phone:        details.formatted_phone_number,
              website:      details.website,
              rating:       place.rating,
              review_count: place.user_ratings_total,
              score,
              status:       'new',
            });

            totalNew++;
            console.log(`[Research] ✅ New lead: ${place.name}, ${city} (score: ${score})`);
          }

          // Respect Google Maps rate limits
          await new Promise(r => setTimeout(r, 200));

        } catch (err) {
          console.error(`[Research] Error scanning ${city}/${category}:`, err.message);
        }
      }
    }
  }

  console.log(`[Research] Done. ${totalNew} new leads added.`);
  return totalNew;
}

module.exports = { runResearchAgent, Lead };
