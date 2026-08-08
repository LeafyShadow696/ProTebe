import { createFileRoute } from "@tanstack/react-router";

import { addDays, compactDate, escapeIcs, fold, stamp } from "@/lib/ics";
import { isCalendarKey } from "@/lib/pair-credentials";

export const Route = createFileRoute("/api/public/calendar/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = String(params.key ?? "").replace(/\.ics$/i, "");
        const separator = raw.indexOf(".");
        const pairId = separator > 0 ? raw.slice(0, separator) : "";
        const calendarKey = separator > 0 ? raw.slice(separator + 1) : "";
        if (!/^[0-9a-f-]{36}$/i.test(pairId) || !isCalendarKey(calendarKey)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pair, error } = await supabaseAdmin
          .from("pairs")
          .select("id, owner_name, partner_name, anniversary, calendar_key")
          .eq("id", pairId)
          .maybeSingle();
        if (error) { console.error(`[protebe] calendar/pair: ${error.message}`); return new Response("Error", { status: 500 }); }
        if (!pair || (pair as { calendar_key: string }).calendar_key !== calendarKey) return new Response("Not found", { status: 404 });

        const { data: events } = await supabaseAdmin
          .from("events")
          .select("id, title, note, starts_on, starts_at, all_day, updated_at")
          .eq("pair_id", pairId)
          .order("starts_on", { ascending: true })
          .limit(1000);

        const calendarName = `Pro Tebe — ${pair.owner_name} & ${pair.partner_name}`;
        const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pro Tebe//Nas kalendar//CS", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapeIcs(calendarName)}`, "X-WR-TIMEZONE:Europe/Prague", "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];

        if (pair.anniversary) {
          lines.push("BEGIN:VEVENT", `UID:anniversary-${pairId}@protebe`, `DTSTAMP:${stamp(new Date())}`, `DTSTART;VALUE=DATE:${compactDate(pair.anniversary)}`, `DTEND;VALUE=DATE:${compactDate(addDays(pair.anniversary, 1))}`, "RRULE:FREQ=YEARLY", `SUMMARY:${escapeIcs(`Náš den — ${pair.owner_name} & ${pair.partner_name}`)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
        }

        for (const event of events ?? []) {
          const updated = event.updated_at ? new Date(event.updated_at) : new Date();
          lines.push("BEGIN:VEVENT", `UID:${event.id}@protebe`, `DTSTAMP:${stamp(updated)}`);
          if (event.all_day || !event.starts_at) {
            lines.push(`DTSTART;VALUE=DATE:${compactDate(event.starts_on)}`, `DTEND;VALUE=DATE:${compactDate(addDays(event.starts_on, 1))}`);
          } else {
            const time = String(event.starts_at).slice(0, 5).replace(":", "");
            lines.push(`DTSTART;TZID=Europe/Prague:${compactDate(event.starts_on)}T${time}00`, "DURATION:PT1H30M");
          }
          lines.push(`SUMMARY:${escapeIcs(event.title)}`);
          if (event.note) lines.push(`DESCRIPTION:${escapeIcs(event.note)}`);
          lines.push("END:VEVENT");
        }
        lines.push("END:VCALENDAR");
        return new Response(lines.map(fold).join("\r\n") + "\r\n", {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="pro-tebe.ics"',
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});