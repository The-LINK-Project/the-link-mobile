# Lesson visuals

These are generated, illustrative Singapore scenes rather than photographs of
named people, businesses, clinics, stations, or worksites. They deliberately
avoid real logos and readable private information.

- `mrt-*`, `alight`, `top-up`, `tap-out`, `interchange`, `reserved-seat`: a Singapore MRT platform, exit, fare gate, train doors, ticket machine, leaving through the gates, interchange concourse and priority seat
- `hawker-centre`, `stall`, `chicken-rice`, `takeaway`, `drink`, `spicy`, `price`, `cash`, `less`: a neighbourhood hawker-centre visit
- `clinic-reception`, `fever`, `pain`, `cough`, `medicine`, `mc`, `appointment`, `rest`: a neighbourhood clinic visit
- `work-safety`, `supervisor`, `helmet`, `safety-boots`, `dangerous`, `day-off`, `break`, `hurt`, `salary`, `again`: work and rest situations in Singapore
- `home-help-scene`, `laundry`, `iron`, `mop`, `dishes`, `rubbish`, `fridge`, `stove`, `cupboard`: housework in an HDB flat
- `meet-people-scene`, `name-tag`, `country`, `family`, `children`, `friend`, `job`, `hobby`, `sunday`: meeting people on a day off
- `reading-signs-scene`, `wet-floor`, `no-entry`, `no-smoking`, `closed`, `push`, `pull`, `toilet`, `danger`: signs in English
- `bus-directions-scene`, `bus-stop`, `bell`, `left`, `right`, `straight`, `traffic-light`, `overhead-bridge`, `map`: taking a bus and finding the way
- `supermarket-scene`, `trolley`, `aisle`, `cashier`, `receipt`, `discount`, `expiry-date`, `plastic-bag`, `vegetables`: a neighbourhood supermarket
- `construction-science-scene`, `concrete`, `cement`, `steel-bar`, `beam`, `column`, `load`, `level`, `scaffold`: materials and structure on a worksite

Every picture key in `src/lib/lessons/icons.ts` has a photo here; the mapping is
`src/lib/lessons/visuals.ts`, and it does not compile with one missing. Pictures
inside a question are always photos, never line icons. New images are 640x640
JPEG, generated with the same brief: photorealistic, present-day Singapore, the
subject large enough to read as a thumbnail, no logos and no readable text. The
exceptions are a few pictures where the words are the point: the signs in the
Reading signs lesson, plus `name-tag`, `discount` and `expiry-date`.
