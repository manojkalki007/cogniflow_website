# Goals — Completion Criteria

## Security
- [ ] SOQL injection: phone input cannot break query (tested with `'; DROP TABLE--`)
- [ ] Google Calendar: warning logged when JSON env var used

## Website
- [ ] Logo renders with transparent background on both light/dark sections
- [ ] OG image: og:image meta tag present, 1200×630, renders on social share
- [ ] Resources nav: no "#" href links anywhere in navigation
- [ ] Mobile sticky CTA: visible on screens < 768px, hidden on desktop
- [ ] Next.js build passes with zero errors

## Voice Pipeline
- [ ] KB context pre-fetched on call start (not during response generation)

## Quality Gates
- [ ] `npx next build` passes
- [ ] No TypeScript errors
- [ ] All existing tests still pass
