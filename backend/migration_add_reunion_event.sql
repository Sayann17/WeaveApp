-- Migration: Add REUNION X SHU-DE Event
-- Run this in your YDB console or via your migration tool

UPSERT INTO events (id, title, description, event_date, image_key, sort_order)
VALUES (
    "reunion-shude-1",
    "REUNION X SHU-DE",
    "REUNION X SHU-DE\n\nMOSCOW. FEBRUARY 14\n\nFC/DC 18-28\n\nПодробности: https://t.me/shude_party",
    Datetime("2025-02-14T18:00:00Z"),
    "reunion_shude",
    1
);
