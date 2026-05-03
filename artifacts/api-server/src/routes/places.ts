import { Router } from "express";
import { SearchPlacesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/search", async (req, res) => {
  const parsed = SearchPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing query parameter q" });
  }
  const { q } = parsed.data;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Google Places API not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      results: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        types: string[];
      }>;
      status: string;
    };

    const results = (data.results || []).map((r) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address,
      types: r.types || [],
    }));

    return res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Places search error");
    return res.status(500).json({ error: "Failed to search places" });
  }
});

router.get("/:placeId", async (req, res) => {
  const { placeId } = req.params;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: "Google Places API not configured" });
  }

  try {
    const fields = [
      "name", "formatted_address", "formatted_phone_number",
      "website", "opening_hours", "photos", "rating",
      "geometry", "address_components", "url",
    ].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      result: {
        name: string;
        formatted_address: string;
        formatted_phone_number?: string;
        website?: string;
        opening_hours?: { weekday_text: string[] };
        photos?: Array<{ photo_reference: string }>;
        rating?: number;
        geometry?: { location: { lat: number; lng: number } };
        address_components?: Array<{ types: string[]; long_name: string; short_name: string }>;
      };
    };

    const r = data.result;
    if (!r) return res.status(404).json({ error: "Place not found" });

    const postcode = r.address_components?.find((c) =>
      c.types.includes("postal_code")
    )?.long_name;

    const photos = (r.photos || []).slice(0, 6).map(
      (p) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${apiKey}`
    );

    return res.json({
      placeId,
      name: r.name,
      address: r.formatted_address,
      postcode: postcode || "",
      phone: r.formatted_phone_number || "",
      website: r.website || "",
      email: "",
      openingHours: r.opening_hours?.weekday_text || [],
      rating: r.rating,
      photos,
      socialLinks: {},
      lat: r.geometry?.location.lat,
      lng: r.geometry?.location.lng,
    });
  } catch (err) {
    req.log.error({ err }, "Place details error");
    return res.status(500).json({ error: "Failed to get place details" });
  }
});

export default router;
