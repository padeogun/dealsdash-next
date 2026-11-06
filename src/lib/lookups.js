// Free public data lookups that run in the browser. Each returns a dated result or throws a plain message.
// An empty planning result means "not confirmed", never "no constraint".
const j = async (url, what) => { let r; try { r = await fetch(url); } catch (e) { throw new Error(`Couldn't reach ${what}. Check your connection and try again.`); } if (!r.ok) throw new Error(`${what} returned an error (${r.status}).`); return r.json(); };
export async function postcodeInfo(pc) { const clean = (pc || "").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z0-9]{5,7}$/.test(clean)) throw new Error("Enter a full postcode first."); return (await j(`https://api.postcodes.io/postcodes/${clean}`, "the postcode service")).result; }
export async function soldPrices(pc) {
  const out = (pc || "").trim().toUpperCase().split(/\s+/)[0];
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(out)) throw new Error("Enter a valid postcode first.");   // validated before going into the query
  const q = `PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/> PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/> SELECT ?paon ?street ?postcode ?amount ?date ?type WHERE { ?t lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ; lrppi:propertyAddress ?a ; lrppi:propertyType ?type . ?a lrcommon:postcode ?postcode . OPTIONAL { ?a lrcommon:paon ?paon } OPTIONAL { ?a lrcommon:street ?street } FILTER(STRSTARTS(STR(?postcode), "${out} ")) } ORDER BY DESC(?date) LIMIT 15`;
  const r = await j("https://landregistry.data.gov.uk/landregistry/query?output=json&query=" + encodeURIComponent(q), "Land Registry");
  return (r.results?.bindings || []).map((b) => ({ address: [b.paon?.value, b.street?.value].filter(Boolean).join(" "), postcode: b.postcode?.value, price: Number(b.amount?.value), date: (b.date?.value || "").slice(0, 10), type: (b.type?.value || "").split("/").pop() }));
}
export async function areaChecks(pc) {
  const p = await postcodeInfo(pc), res = { checkedAt: new Date().toISOString().slice(0, 10), district: p.admin_district, country: p.country };
  res.crime = await j(`https://data.police.uk/api/crimes-street/all-crime?lat=${p.latitude}&lng=${p.longitude}`, "Police.uk").then((c) => ({ total: c.length, month: c[0]?.month || null })).catch((e) => ({ error: e.message }));
  res.flood = p.country === "England" ? await j(`https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${p.latitude}&long=${p.longitude}&dist=3`, "Environment Agency").then((f) => ({ areas: (f.items || []).length })).catch((e) => ({ error: e.message })) : { error: "Environment Agency data covers England only." };
  res.lat = p.latitude; res.lng = p.longitude;
  return res;
}
