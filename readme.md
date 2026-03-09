asd## Do NOT EDIT or COMMIT ".env" file ! 
# . push test . 2. .
,
.
.
Deployment notes. 
    cd BedTrip_ui/
    unset NODE_ENV
    node --version
    npm ci
    npx vite build
    cd ..
    npm ci
    npm run build
    npm run build:ui
    pkill -f node


## API
    api/b2b/v3/hotel/info
    - Paiement par carte (Kotan Payments) 
    - 
## New updates 
    - Added date field (bookingView)
    - Removed filter(hotel & appartement)
    - Added banner (to show user can pay in installement)
    - merge dev into master(quick test build)
    - Added map filtering and distances
    - I’m now removing robots.txt from git tracking (keeping the file locally) so future builds won’t block pulls
    - Replaced “loading text only” with gallery skeleton loading.
    - During retry phase, skeleton stays visible with loading note.
    - Added fallback image fetch limits (15 -> 10 -> 6 -> 3 -> 1) when provider is saturated.
    - Added graceful handling for endpoint_exceeded_limit (no raw error exposed).
    - Added automatic retries with cooldown and manual Réessayer button.
    - Added visible loading banner + spinner while results load.
    - Kept skeleton, but now users clearly see active loading state.

