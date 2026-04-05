const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, 'scraped_data');
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TARGET_MAX = 500;

const BROWSER_PROFILES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    }
  }
];

const ALL_URLS = [
  // Indian Express - Comprehensive list
  'https://indianexpress.com/article/cities/pune/tragedy-on-pune-solapur-highway-3-killed-tyre-burst-flings-muv-into-opposite-lane-10586331/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-sc-bail-father-driver-police-speedy-trial-conviction-10577052/',
  'https://indianexpress.com/article/legal-news/supreme-court-bail-father-pune-porsche-crash-case-10574529/',
  'https://indianexpress.com/article/cities/pune/trial-pune-porsche-crash-case-next-year-10441664/',
  'https://indianexpress.com/article/cities/pune/killed-injured-pune-accident-navale-bridge-selfie-point-10363830/',
  'https://indianexpress.com/article/cities/pune/pune-rto-report-says-driver-lost-control-in-navale-bridge-accident-10384502/',
  'https://indianexpress.com/article/cities/pune/two-killed-one-critical-speeding-truck-hits-five-vehicles-pune-satara-highway-10160307/',
  'https://indianexpress.com/article/cities/pune/bus-climbs-footpath-hinjewadi-crushes-two-schoolchildren-10396677/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-police-dismiss-service-dereliction-duty-10413046/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-truck-was-overloaded-culpable-homicide-police-10366333/',
  'https://indianexpress.com/article/cities/pune/almost-a-month-after-wife-dies-in-pune-road-accident-guitarist-husband-booked-for-negligence-10507574/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-exposed-systemic-corruption-police-commissioner-amitesh-kumar-10295060/',
  'https://indianexpress.com/article/cities/pune/pune-mumbai-expressway-accident-heavy-vehicle-inspection-fitness-10527280/',
  'https://indianexpress.com/article/cities/pune/pune-road-crash-deaths-down-15-but-pedestrians-two-wheeler-riders-account-for-90-of-fatalities-10463000/',
  'https://indianexpress.com/article/cities/pune/hit-and-run-accident-kills-morning-walker-in-pune-undri-locals-call-for-more-speed-bumps-9918694/',
  'https://indianexpress.com/article/cities/pune/three-killed-as-car-crashes-into-metro-pillar-born-six-months-apart-two-cousins-grew-up-together-10342348/',
  'https://indianexpress.com/article/cities/pune/road-accident-hadapsar-kills-boy-driver-held-9914926/',
  'https://indianexpress.com/article/cities/pune/pune-hit-and-run-suv-driver-arrested-morning-walker-accident-death-9919515/',
  'https://indianexpress.com/article/cities/pune/road-gradient-traffic-changes-gangadham-chowk-aai-mata-temple-10505720/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-victims-in-car-were-returning-from-narayanpur-temple-10364378/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-fire-burn-injuries-9893971/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-deep-gash-on-forehead-barely-remember-what-hit-me-10364280/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-families-recall-terrifying-crash-10365926/',
  'https://indianexpress.com/article/cities/pune/three-injured-after-pmpml-bus-crashes-7-vehicles-brake-failure-suspected-9973279/',
  'https://indianexpress.com/article/cities/pune/vehicles-collide-road-mishap-bhumkar-chowk-no-casualties-10371194/',
  'https://indianexpress.com/article/cities/pune/10-women-killed-in-pune-road-mishap-10183690/',
  'https://indianexpress.com/article/cities/pune/old-man-dies-two-wheeler-skids-roadside-aundh-10164289/',
  'https://indianexpress.com/article/cities/pune/pune-cops-slap-attempt-to-culpable-homicide-charges-heavy-vehicles-flouting-rules-sushant-kulkarni-10433620/',
  'https://indianexpress.com/article/cities/pune/pune-drunk-it-professional-rams-car-into-pubs-parking-valet-attendant-dead-10395022/',
  'https://indianexpress.com/article/cities/pune/tempo-driver-killed-four-vehicles-crash-old-pune-mumbai-highway-10022787/',
  'https://indianexpress.com/article/cities/pune/pune-23-year-old-student-killed-in-road-accident-in-lohegaon-10032686/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-school-bus-hits-car-injured-10409561/',
  'https://indianexpress.com/article/cities/pune/1-5-year-old-run-over-by-water-tanker-pune-reverse-police-arrest-9927988/',
  'https://indianexpress.com/article/cities/pune/cyber-security-expert-killed-accident-pune-mumbai-expressway-9940779/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-truck-driver-cleaner-vehicle-owner-rajasthan-booked-culpable-homicide-10364898/',
  'https://indianexpress.com/article/cities/pune/mumbai-pune-expressway-truck-crash-luxury-car-crash-dead-victims-live-10151730/',
  'https://indianexpress.com/article/cities/pune/pune-woman-booked-for-73-yr-olds-death-in-road-accident-10169720/',
  'https://indianexpress.com/article/cities/pune/woman-pilgrim-killed-10-injured-as-speeding-truck-ploughs-into-warkari-procession-on-old-pune-mumbai-highway-10358825/',
  'https://indianexpress.com/article/cities/pune/pune-lawyer-dies-speeding-car-rams-motorcycle-driver-arrested-10010142/',
  'https://indianexpress.com/article/cities/pune/bridge-collapse-pune-indrayani-river-10068179/',
  'https://indianexpress.com/article/cities/pune/pune-it-hub-minibus-fire-police-arrest-driver-who-started-fire-9909564/',
  'https://indianexpress.com/article/cities/pune/death-of-2-wheeler-rider-due-to-falling-of-tree-pmc-officials-booked-9552669/',
  'https://indianexpress.com/article/cities/pune/4-vehicles-collide-near-ved-bhavan-in-kothrud-bus-driver-injured-10070433/',
  'https://indianexpress.com/article/cities/pune/10-hurt-private-bus-bypass-pune-9905696/',
  'https://indianexpress.com/article/cities/pune/heavy-vehicles-only-at-night-height-barriers-shifting-liquor-shops-to-prevent-mishaps-police-chief-after-accident-at-gangadham-chowk-10063633/',
  'https://indianexpress.com/article/cities/pune/drunk-driver-bus-killed-3-siblings-hinjewadi-police-custody-10398711/',
  'https://indianexpress.com/article/cities/pune/mercedes-crash-bike-pune-wadgaon-bridge-death-9980240/',
  'https://indianexpress.com/article/cities/pune/woman-dies-after-dumper-carrying-gravel-for-pune-ring-road-plunges-into-house-10539612/',
  'https://indianexpress.com/article/cities/pune/tempo-truck-rams-into-police-jeep-on-pune-mumbai-highway-3-metro-wardens-injured-driver-held-10084132/',
  'https://indianexpress.com/article/cities/pune/khed-accident-pimpri-chinchwad-police-invoke-culpable-homicide-charges-against-driver-10184968/',
  'https://indianexpress.com/article/cities/pune/7-dead-van-carrying-devotees-crashes-30-feet-down-in-khed-10182918/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-900-page-preliminary-chargesheet-filed-9478079/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-pune-rto-9361795/',
  'https://indianexpress.com/article/cities/pune/truck-driver-runs-over-family-footpath-pune-dead-9739763/',
  'https://indianexpress.com/article/cities/pune/woman-killed-two-grandkids-injured-in-accident-techie-rider-booked-9733055/',
  'https://indianexpress.com/article/cities/pune/porsche-car-crash-minors-blood-swapped-mother-father-brother-liquor-police-chief-9591834/',
  'https://indianexpress.com/article/cities/pune/minor-accused-pune-porsche-crash-not-getting-college-admission-anywhere-9589472/',
  'https://indianexpress.com/article/cities/pune/retd-government-officer-dies-in-road-mishap-at-karve-road-9522637/',
  'https://indianexpress.com/article/cities/pune/4-injured-as-tempo-hits-6-vehicles-at-traffic-signal-in-punes-moshi-9661678/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-govt-gives-sanction-to-prosecute-sassoon-hospital-doctors-staffer-accused-of-changing-blood-samples-9637312/',
  'https://indianexpress.com/article/cities/pune/msrtc-bus-falls-in-trench-in-punes-bhor-42-passengers-suffer-minor-injuries-9597454/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-court-rejects-anticipatory-bail-plea-of-father-of-minor-drivers-friend-9558992/',
  'https://indianexpress.com/article/cities/pune/disruption-queue-gas-leak-tanker-overturns-traffic-pune-mumbai-expressway-10513912/',
  'https://indianexpress.com/article/cities/pune/commuters-describe-ordeal-after-mumbai-pune-expressway-accident-10514069/',
  'https://indianexpress.com/article/cities/mumbai/expressway-mishap-msrdc-emergency-plan-avoid-repeat-gridlock-10516641/',
  // Bridge Chronicle - Comprehensive list
  'https://www.thebridgechronicle.com/pune/pune-accident-speeding-car-overturns-navale-bridge-satara-highway-agn97',
  'https://www.thebridgechronicle.com/pune/pune-mumbai-expressway-accident-khopoli-3-dead-injured-agn97',
  'https://www.thebridgechronicle.com/pune/pune-bus-truck-accident-university-road-traffic-jam-agn97',
  'https://www.thebridgechronicle.com/pune/pune-three-teenagers-killed-train-accident-majari-budruk-agn97',
  'https://www.thebridgechronicle.com/pune/hinjawadi-it-park-accident-speeding-bus-runs-over-two-siblings-agn97',
  'https://www.thebridgechronicle.com/news/kalyani-nagar-accident-drunk-driving-penalties-pune-2025',
  'https://www.thebridgechronicle.com/news/pune-two-fatal-accidents-young-biker-pedestrian-killed-speeding-vehicles-agn97',
  'https://www.thebridgechronicle.com/pune/pune-900-road-deaths-helmets-blackspots-safety',
  'https://www.thebridgechronicle.com/pune/mumbai-pune-expressway-traffic-disruption-aks21',
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-fatal-collision-road-safety-concern-agn97',
  'https://www.thebridgechronicle.com/pune/pune-young-woman-dies-speeding-tempo-hits-two-wheeler-hirabaug-chowk-agn97',
  'https://www.thebridgechronicle.com/pune/mumbai-pune-expressway-traffic-jam-propylene-gas-tanker-lonavala-agn97',
  'https://www.thebridgechronicle.com/pune/cm-probe-32-hour-mumbai-pune-expressway-jam-emergency-plan-missing-link-agn97',
  'https://www.thebridgechronicle.com/pune/pune-valet-worker-killed-drunk-driving-kalyani-nagar-agn97',
  'https://www.thebridgechronicle.com/pune/navale-bridge-accident-pune-six-month-road-safety-overhaul-agn97',
  'https://www.thebridgechronicle.com/pune/supreme-court-bail-vishal-agarwal-pune-porsche-crash-case-agn97',
  'https://www.thebridgechronicle.com/pune/tamhini-ghat-fatal-crash-pune-residents-500-foot-fall-aks21',
  'https://www.thebridgechronicle.com/news/pune-accident-who-is-responsible-for-road-death',
  'https://www.thebridgechronicle.com/news/sadashiv-peth-car-accident-injured-students-exam-postponement',
  'https://www.thebridgechronicle.com/pune/pune-drunk-school-bus-driver-wagholi-arrested-agn97',
  'https://www.thebridgechronicle.com/news/pune-speeding-school-bus-kills-two-wheeler-rider-on-karve-road',
  'https://www.thebridgechronicle.com/news/dashcam-captures-car-losing-control-crashing-into-two-bikers-in-wakad',
  'https://www.thebridgechronicle.com/pune/pune-accident-heavy-vehicles-turning-city-roads-into-death-traps',
  'https://www.thebridgechronicle.com/pune/pune-police-crackdown-heavy-vehicles-fatal-accidents',
  'https://www.thebridgechronicle.com/media/video/pune-navale-bridge-massive-accident-8-dead-safety-failure-as99',
  'https://www.thebridgechronicle.com/news/pune-police-seek-dismissal-of-suspended-officers-in-porsche-car-hit-and-run-case',
  'https://thebridgechronicle.com/pune-porsche-case-tragic-accident',
  'https://www.thebridgechronicle.com/news/pune-truck-accidents-no-injuries',
  'https://www.thebridgechronicle.com/pune/three-killed-two-children-injured-road-accidents-pune',
  'https://www.thebridgechronicle.com/pune/army-officer-saves-driver-car-plunges-into-drain-wanowrie-pune-agn97',
  'https://www.thebridgechronicle.com/pune/pune-university-chowk-flyover-traffic-chaos-agn97',
  'https://www.thebridgechronicle.com/news/bhukum-couple-killed-in-dump-truck-motorcycle-collision-driver-flees',
  'https://www.thebridgechronicle.com/news/porsche-kalyaninagar-accident-chargesheet-filed-against-two-more-accused',
  'https://www.thebridgechronicle.com/news/pune-porsche-accident-families-of-victims-meet-cm-eknath-shinde',
  'https://www.thebridgechronicle.com/news/fire-undri-high-rise-pune-teen-killed-agn97',
  'https://www.thebridgechronicle.com/news/pune-22-year-old-student-killed-in-high-speed-car-crash-on-katraj-manterwadi-bypass-road',
  'https://www.thebridgechronicle.com/news/pune-woman-killed-granddaughter-injured-in-accident-with-speeding-pmpml-bus',
  'https://www.thebridgechronicle.com/news/heavy-vehicle-ban-violated-beauty-parlor-trainee-killed-as-dumper-hits-two-wheeler-in-baner',
  'https://www.thebridgechronicle.com/news/negligence-on-wheels-ambulance-driver-flees-after-hitting-motorcyclist-near-katraj-dairy',
  'https://www.thebridgechronicle.com/pune/swargate-jedhe-chowk-traffic-encroachment-danger-zone-agn97',
  'https://www.thebridgechronicle.com/pune/pune-roads-abandoned-vehicles-civic-action-pending-agn97',
  'https://www.thebridgechronicle.com/pune/pmc-reinstall-speed-breakers-after-pune-grand-tour-agn97',
  'https://www.thebridgechronicle.com/news/pune-retired-acp-injured-motorcycle-loose-internet-cable-tilak-road',
  'https://www.thebridgechronicle.com/news/motorcyclist-dies-after-crashing-into-electric-pole-on-katraj-kondhwa-road',
  'https://www.thebridgechronicle.com/pune/cyclists-collide-pune-grand-cycle-tour-narrow-road-statement-mp99',
  'https://www.thebridgechronicle.com/pune/pune-deadly-crash-katraj-tunnel-truck-driver-dies-passengers-injured-agn97',
  'https://www.thebridgechronicle.com/pune/deadly-pune-roads-290-deaths-two-wheeler-pedestrians-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-dumper-collides-eight-vehicles-katraj-dehu-road-mp99',
  'https://www.thebridgechronicle.com/pune/repeat-drunk-driving-vehicle-seizure-pune-police-agn97',
  'https://www.thebridgechronicle.com/pune/pune-bridge-collapse-four-dead-50-injured-maval',
  'https://www.thebridgechronicle.com/pune/pune-crane-trailer-overturns-mundhwa-bridge-traffic-disruption-agn97',
  'https://www.thebridgechronicle.com/pune/eight-killed-four-injured-jejuri-morgaon-road-accident-pune-pm-modi-ex-gratia',
  'https://www.thebridgechronicle.com/pune/mumbai-pune-expressway-reopens-after-32-hours-commuter-frustration-agn97',
  'https://www.thebridgechronicle.com/pune/expressway-gas-tanker-clearance-delayed-32-hours-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-truck-rams-two-cars-bike-vadgaon-flyover-rider-killed',
  'https://www.thebridgechronicle.com/news/pune-birthday-party-ends-in-tragedy-swift-car-crashes-into-bus-two-dead-four-injured',
  'https://www.thebridgechronicle.com/pune/medha-kulkarni-urges-strict-measures-to-curb-rising-road-accidents-india-agn97',
  'https://www.thebridgechronicle.com/pune/pune-4-year-old-girl-critical-ncp-mla-dnyaneshwar-katke-car-agn97',
  'https://www.thebridgechronicle.com/pune/supreme-court-bail-pune-porsche-blood-sample-tampering-agn97',
  'https://www.thebridgechronicle.com/news/pune-woman-dies-tree-falls-autorickshaw-monsoon',
  'https://www.thebridgechronicle.com/pune/pune-police-officers-dismissed-porsche-case-investigation-lapses-agn97',
  'https://www.thebridgechronicle.com/pune/pune-container-rams-five-vehicles-pune-satara-highway-five-injured-two-critical',
  'https://www.thebridgechronicle.com/pune/pune-kalepadal-drunk-driving-accident-agn97',
  'https://www.thebridgechronicle.com/pune/msrtc-driver-killed-nine-injured-pune-mumbai-expressway-accident-lonavala',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-deadly-collision-between-two-st-buses-leaves-1-dead-69-injured',
  'https://www.thebridgechronicle.com/news/father-and-son-killed-in-highway-collision-3-family-members-critically-injured',
  'https://www.thebridgechronicle.com/news/mahabaleshwar-two-from-loni-kalbhor-killed-as-suv-falls-into-pasarni-ghat-gorge',
  'https://www.thebridgechronicle.com/news/woman-killed-six-injured-in-st-bus-car-collision-on-old-mumbai-pune-highway',
  'https://www.thebridgechronicle.com/news/st-bus-hits-truck-on-expressway-one-passenger-dies-multiple-injuries-reported',
  'https://www.thebridgechronicle.com/news/motor-accident-claims-tribunal-grants-244-crore-to-family-of-engineer-killed-in-crash',
  'https://www.thebridgechronicle.com/news/junnar-two-dead-18-injured-in-bus-car-collision-on-nagar-kalyan-highway',
  'https://www.thebridgechronicle.com/news/fiery-accident-on-old-pune-mumbai-highway-trailer-gutted-driver-hospitalized',
  'https://www.thebridgechronicle.com/news/wagholi-speeding-dumper-kills-woman-on-pune-nagar-highway-husband-injured',
  'https://www.thebridgechronicle.com/news/massive-multi-vehicle-collision-on-warje-bridge-no-casualties-reported',
  'https://www.thebridgechronicle.com/news/accident-on-nibm-road-minor-rams-speeding-tanker-into-bike-two-injured',
  'https://www.thebridgechronicle.com/news/nagar-road-passenger-killed-in-autorickshaw-mishap-driver-found-intoxicated',
  'https://www.thebridgechronicle.com/news/minor-driving-without-a-license-causes-fatal-accident-12-year-old-boy-dead',
  'https://www.thebridgechronicle.com/news/chakan-shikrapur-road-accident-speeding-truck-claims-lives-of-father-and-two-young-sons',
  'https://www.thebridgechronicle.com/news/hinjewadi-two-software-engineers-killed-in-motorcycle-accident',
  'https://www.thebridgechronicle.com/news/kothrud-speeding-bike-crashes-into-paud-phata-flyover-barrier-two-college-students-dead',
  'https://www.thebridgechronicle.com/news/husband-and-wife-die-in-car-accident-on-pune-nashik-highway-one-seriously-injured',
  'https://www.thebridgechronicle.com/news/porsche-car-crash-case-pune-police-to-file-chargesheet-soon',
  'https://www.thebridgechronicle.com/news/army-forensic-expert-helps-prepare-porsche-car-crash-impact-assessment-report',
  'https://www.thebridgechronicle.com/news/pune-police-push-for-fast-track-handling-of-porsche-accident-case',
  'https://www.thebridgechronicle.com/news/mumbai-high-court-criticizes-pune-police-over-handling-of-porsche-accident-case-involving-minor',
  'https://www.thebridgechronicle.com/news/accident-on-nibm-road-minor-rams-speeding-tanker-into-bike-two-injured',
  'https://www.thebridgechronicle.com/news/chandani-chowk-accident-speeding-cargo-bus-hits-bikers-3-persons-injured',
  'https://www.thebridgechronicle.com/news/courier-delivery-executive-fatally-hit-by-speeding-mercedes-benz-at-golf-course-chowk',
  'https://www.thebridgechronicle.com/news/retired-agriculture-officer-fatally-struck-by-dumper-on-karve-road',
  'https://www.thebridgechronicle.com/news/pune-belbaug-chowk-pmc-truck-falls-into-25-foot-pit-no-casualties-reported',
  'https://www.thebridgechronicle.com/news/fallen-tree-branch-kills-motorcyclist-pmc-garden-department-officials-charged',
  'https://www.thebridgechronicle.com/news/pomegranate-laden-truck-catches-fire-after-collision-with-dumper-two-injured',
  'https://www.thebridgechronicle.com/news/pmc-to-reduce-slope-at-gangadham-chowk-after-fatal-accident',
  'https://www.thebridgechronicle.com/news/kalyani-nagar-accident-pune-court-rejects-bail-for-two-in-evidence-tampering-plot',
  'https://www.thebridgechronicle.com/news/brake-failure-leads-pmpml-bus-to-crash-in-dhayari-no-injuries-reported',
  'https://www.thebridgechronicle.com/news/moshi-hit-and-run-police-officers-son-booked-after-cctv-footage-goes-viral',
  'https://www.thebridgechronicle.com/news/pune-glass-factory-owner-and-five-others-charged-with-culpable-homicide',
  'https://www.thebridgechronicle.com/news/two-trainee-pilots-dead-two-critically-injured-in-car-accident-on-baramati-bhigwan-road',
  'https://www.thebridgechronicle.com/news/wagholi-pedestrian-killed-by-st-bus-on-pune-nagar-highway',
  'https://www.thebridgechronicle.com/news/wagholi-footpath-accident-dumper-owner-anil-kate-arrested-on-negligence-charges',
  'https://www.thebridgechronicle.com/news/lonavala-bus-crash-on-mumbai-pune-expressway-leaves-23-passengers-injured',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-luxury-bus-and-truck-collision-claims-one-life',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-accident-container-truck-traffic-jam-2025',
  'https://www.thebridgechronicle.com/news/accidents-on-pune-mumbai-expressway-rise-despite-stricter-regulations',
  'https://www.thebridgechronicle.com/news/two-separate-motorbike-accidents-in-pune-leave-one-dead-two-injured',
  // More Indian Express 2021-2023 articles
  'https://indianexpress.com/article/cities/pune/caution-drive-safely-ten-trauma-hotspots-identified-in-pune-8991618/',
  'https://indianexpress.com/article/cities/pune/in-15-months-26-killed-in-161-bus-accidents-pune-transport-body8877390/',
  'https://indianexpress.com/article/cities/pune/29-injured-in-head-on-collision-of-2-pmpml-buses-on-pune-ahmednagar-road-8871420/',
  'https://indianexpress.com/article/cities/pune/mumbai-bangalore-highway-bus-truck-accident-deaths-injuries-8570932/',
  'https://indianexpress.com/article/cities/pune/tempo-hits-two-wheeler-2-cars-on-highway-10-injured-8686068/',
  'https://indianexpress.com/article/cities/pune/people-carrying-shivjayanti-jyot-injured-pune-truck-hits-tempo-8488541/',
  'https://indianexpress.com/article/cities/pune/one-dead-three-injured-as-bus-sliding-back-hits-six-vehicles-8621698/',
  'https://indianexpress.com/article/cities/pune/accident-pune-navale-bridge-tanker-collides-vehicles-casualties-8291281/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-highlights-traffic-management-infrastructure-woes-on-katraj-dehu-road-bypass-8281620/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-navale-bridge-live-news-updates-8280381/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-authorities-phased-reduction-of-heavy-vehicles-speed-limits-8282344/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-no-brake-failure-driver-turned-off-ignition-to-save-fuel-say-police-after-rto-assessment-8280342/',
  'https://indianexpress.com/article/cities/pune/pune-several-injured-as-truck-runs-into-vehicles-near-navale-bridge-7397833/',
  'https://indianexpress.com/article/cities/pune/two-killed-in-road-mishap-at-dive-ghat-on-pune-saswad-road/',
  'https://indianexpress.com/article/cities/pune/pune-two-killed-in-separate-road-accidents-7258816/',
  'https://indianexpress.com/article/cities/pune/maharashtra-bus-accident-family-pune-found-in-tight-embrace-8695847/',
  'https://indianexpress.com/article/cities/pune/injured-in-road-accident-bjp-mla-gore-discharged-from-hospital-8364463/',
  'https://indianexpress.com/article/cities/pune/six-injured-as-truck-with-suspected-brake-failure-rams-several-vehicles-in-pune-8279802/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-the-most-dangerous-patch-of-road-in-pune-8287577/',
  'https://indianexpress.com/article/cities/pune/3-from-pune-family-killed-after-bus-topples-near-kolhapur-9038870/',
  'https://indianexpress.com/article/cities/pune/four-injured-as-container-hits-five-vehicles-near-navale-bridge-9051959/',
  'https://indianexpress.com/article/cities/pune/5-friends-killed-as-truck-overturns-on-them-on-pune-mumbai-expressway-6296403/',
  'https://indianexpress.com/article/cities/pune/bus-accident-mumbai-bengaluru-highway-8506134/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-falls-into-dive-ghat-valley-driver-dies-7833538/',
  'https://indianexpress.com/article/cities/pune/fatalities-on-old-mumbai-pune-highway-drop-by-54-since-2018-7586183/',
  'https://indianexpress.com/article/cities/pune/no-permanent-solution-till-gradient-of-the-slope-of-navale-bridge-is-reduced-police-commissioner-8281617/',
  'https://indianexpress.com/article/cities/pune/mumbai-nagpur-expressway-accident-among-those-dead-3-members-each-of-2-families-8696569/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-vehicles-accident-9178561/',
  'https://indianexpress.com/article/cities/pune/pune-kin-of-woman-killed-in-accident-gets-rs-1-crore-compensation-9195498/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-felt-like-experiencing-a-tremor-feel-fortunate-to-have-escaped-with-life-survivors-8281644/',
  'https://indianexpress.com/article/cities/pune/narrow-escape-for-40-passengers-as-branch-falls-on-pmpml-bus-driver-suffers-injuries-8929753/',
  'https://indianexpress.com/article/cities/pune/pune-1-dead-after-bus-rams-truck-on-expressway-6180343/',
  'https://indianexpress.com/article/cities/pune/drunk-driver-car-footpath-injures-software-engineers-police-8266557/',
  'https://indianexpress.com/article/cities/pune/mumbai-expressway-turns-death-trap-in-2024-26-rise-in-deaths-9796518/',
  // More Bridge Chronicle articles
  'https://www.thebridgechronicle.com/news/19-pune-dead-2-accidents-kolhapur-12350',
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-accident-sees-vehicles-piling-52662',
  'https://www.thebridgechronicle.com/pune/mumbai-pune-expressway-accident-five-killed-several-injured-in-multiple-vehicles-collision',
  'https://www.thebridgechronicle.com/news/supreme-court-grants-bail-shivani-agarwal-pune-porsche-accident',
  'https://www.thebridgechronicle.com/pune/not-again-punes-navale-bridge-witnesses-another-accident-after-truck-ploughs-through-multiple-vehicles',
  'https://www.thebridgechronicle.com/news/tears-and-tragedy-at-ycm-hospital-as-families-identify-hinjewadi-tempo-fire-victims',
  'https://www.thebridgechronicle.com/news/tamhini-ghat-accident-wedding-journey-turns-tragic-two-dead-as-bus-overturns',
  'https://www.thebridgechronicle.com/pune/pmc-compensation-for-pothole-accidents-pune-agn97',
  'https://www.thebridgechronicle.com/news/pune-kothrud-metro-pillar-car-accident-agn97',
  'https://www.thebridgechronicle.com/pune/pune-three-dead-several-injured-in-two-separate-accidents',
  'https://www.thebridgechronicle.com/news/pune-porsche-case-all-recent',
  'https://www.thebridgechronicle.com/news/motor-accident-claims-tribunal-grants-244-crore-to-family-of-engineer-killed-in-crash',
  'https://www.thebridgechronicle.com/news/junnar-two-dead-18-injured-in-bus-car-collision-on-nagar-kalyan-highway',
  'https://www.thebridgechronicle.com/news/fiery-accident-on-old-pune-mumbai-highway-trailer-gutted-driver-hospitalized',
  'https://www.thebridgechronicle.com/news/wagholi-speeding-dumper-kills-woman-on-pune-nagar-highway-husband-injured',
  'https://www.thebridgechronicle.com/news/massive-multi-vehicle-collision-on-warje-bridge-no-casualties-reported',
  'https://www.thebridgechronicle.com/news/nagar-road-passenger-killed-in-autorickshaw-mishap-driver-found-intoxicated',
  'https://www.thebridgechronicle.com/news/minor-driving-without-a-license-causes-fatal-accident-12-year-old-boy-dead',
  'https://www.thebridgechronicle.com/news/chakan-shikrapur-road-accident-speeding-truck-claims-lives-of-father-and-two-young-sons',
  'https://www.thebridgechronicle.com/news/kothrud-speeding-bike-crashes-into-paud-phata-flyover-barrier-two-college-students-dead',
  'https://www.thebridgechronicle.com/news/husband-and-wife-die-in-car-accident-on-pune-nashik-highway-one-seriously-injured',
  'https://www.thebridgechronicle.com/news/heavy-vehicle-ban-violated-beauty-parlor-trainee-killed-as-dumper-hits-two-wheeler-in-baner',
  'https://www.thebridgechronicle.com/news/negligence-on-wheels-ambulance-driver-flees-after-hitting-motorcyclist-near-katraj-dairy',
  'https://www.thebridgechronicle.com/news/pune-police-crackdown-heavy-vehicles-fatal-accidents',
  'https://www.thebridgechronicle.com/news/pune-glass-factory-owner-and-five-others-charged-with-culpable-homicide',
  'https://www.thebridgechronicle.com/news/brake-failure-leads-pmpml-bus-to-crash-in-dhayari-no-injuries-reported',
  'https://www.thebridgechronicle.com/news/moshi-hit-and-run-police-officers-son-booked-after-cctv-footage-goes-viral',
  'https://www.thebridgechronicle.com/news/kalyani-nagar-accident-pune-court-rejects-bail-for-two-in-evidence-tampering-plot',
  'https://www.thebridgechronicle.com/news/army-forensic-expert-helps-prepare-porsche-car-crash-impact-assessment-report',
  'https://www.thebridgechronicle.com/news/porsche-car-crash-case-pune-police-to-file-chargesheet-soon',
  'https://www.thebridgechronicle.com/news/pune-police-push-for-fast-track-handling-of-porsche-accident-case',
  'https://www.thebridgechronicle.com/news/mumbai-high-court-criticizes-pune-police-over-handling-of-porsche-accident-case-involving-minor',
  // More Indian Express 2018-2020 articles
  'https://indianexpress.com/article/cities/pune/pune-seven-members-of-family-including-three-children-killed-in-highway-accident/',
  'https://indianexpress.com/article/cities/pune/pune-satara-highway-birthday-boy-among-three-friends-killed-in-accident-4-hurt-5846733/',
  'https://indianexpress.com/article/cities/pune/two-die-as-shivshahi-bus-rams-into-truck-on-pune-solapur-highway-5952929/',
  'https://indianexpress.com/article/cities/pune/pune-prominent-spine-surgeon-driver-killed-in-accident-on-pune-mumbai-expressway-5998667/',
  'https://indianexpress.com/article/cities/pune/old-pune-mumbai-highway-seven-die-in-accident-near-lonavala-5261005/',
  'https://indianexpress.com/article/cities/pune/pune-four-killed-as-hoarding-on-rail-premises-collapses-on-road-5389117/',
  'https://indianexpress.com/article/cities/pune/pune-hoarding-frame-collapses-near-juna-bazaar-three-killed-5388658/',
  'https://indianexpress.com/article/cities/pune/17-including-children-dead-as-truck-veers-off-highway-crashes-5131140/',
  'https://indianexpress.com/article/cities/pune/mumbai-bengaluru-highway-bus-truck-accident-deaths-injuries-8570932/',
  'https://indianexpress.com/article/cities/pune/pune-motorcyclist-pillion-rider-die-after-speeding-truck-hits-bike-6241789/',
  'https://indianexpress.com/article/cities/pune/pune-mumbai-expressway-records-steady-decline-in-fatal-accidents-6283049/',
  'https://indianexpress.com/article/cities/pune/5-friends-killed-as-truck-overturns-on-them-on-pune-mumbai-expressway-6296403/',
  'https://indianexpress.com/article/cities/pune/6326108pune-truck-catches-fire-on-highway-driver-dead/',
  'https://indianexpress.com/article/cities/pune/one-dead-after-bus-rams-truck-on-expressway-6180343/',
  'https://indianexpress.com/article/cities/pune/pune-pwd-identifies-51-accident-prone-spots-plans-to-rectify-them-by-may-5549305/',
  'https://indianexpress.com/article/cities/pune/two-sisters-killed-in-accident-on-pune-solapur-highway-8100920/',
  'https://indianexpress.com/article/cities/pune/pune-two-killed-in-separate-road-accidents-7258816/',
  'https://indianexpress.com/article/cities/pune/pune-several-injured-as-truck-runs-into-vehicles-near-navale-bridge-7397833/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-live-news-updates-8280381/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-highlights-traffic-management-infrastructure-woes-on-katraj-dehu-road-bypass-8281620/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-authorities-phased-reduction-of-heavy-vehicles-speed-limits-8282344/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-no-brake-failure-driver-turned-off-ignition-to-save-fuel-say-police-after-rto-assessment-8280342/',
  'https://indianexpress.com/article/cities/pune/no-permanent-solution-till-gradient-of-the-slope-of-navale-bridge-is-reduced-police-commissioner-8281617/',
  'https://indianexpress.com/article/cities/pune/6-accidents-in-7-hours-on-katraj-dehu-road-bypass-3-killed-16-injured-7142579/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-falls-into-dive-ghat-valley-driver-dies-7833538/',
  'https://indianexpress.com/article/cities/pune/mumbai-expressway-turns-death-trap-in-2024-26-rise-in-deaths-9796518/',
  'https://indianexpress.com/article/cities/pune/fatalities-on-old-mumbai-pune-highway-drop-by-54-since-2018-7586183/',
  'https://indianexpress.com/article/cities/pune/3-from-pune-family-killed-after-bus-topples-near-kolhapur-9038870/',
  'https://indianexpress.com/article/cities/pune/29-injured-in-head-on-collision-of-2-pmpml-buses-on-pune-ahmednagar-road-8871420/',
  'https://indianexpress.com/article/cities/pune/people-carrying-shivjayanti-jyot-injured-pune-truck-hits-tempo-8488541/',
  'https://indianexpress.com/article/cities/pune/12-injured-in-pune-as-bus-veers-off-mumbai-bengaluru-highway-falls-15-feet-8506134/',
  'https://indianexpress.com/article/cities/pune/one-dead-three-injured-as-bus-sliding-back-hits-six-vehicles-8621698/',
  'https://indianexpress.com/article/cities/pune/tempo-hits-two-wheeler-2-cars-on-highway-10-injured-8686068/',
  'https://indianexpress.com/article/cities/pune/maharashtra-bus-accident-family-pune-found-in-tight-embrace-8695847/',
  'https://indianexpress.com/article/cities/pune/mumbai-nagpur-expressway-accident-among-those-dead-3-members-each-of-2-families-8696569/',
  // Fresh URLs from searches
  'https://indianexpress.com/article/cities/pune/road-accidents-black-spots-pune-9795885/',
  'https://indianexpress.com/article/cities/pune/pune-road-crash-deaths-down-15-but-pedestrians-two-wheeler-riders-account-for-90-of-fatalities-10463000/',
  'https://indianexpress.com/article/cities/pune/mumbai-pune-expressway-accident-survivors-trauma-bmw-truck-crash-9798563/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-vehicles-accident-9178561/',
  'https://indianexpress.com/article/cities/pune/4-injured-suv-3-vehicles-pune-mumbai-highway-techie-driver-9702837/',
  'https://indianexpress.com/article/cities/pune/porsche-accident-minors-pubs-timings-kalyani-nagar-koregaon-park-9339159/',
  'https://indianexpress.com/article/cities/pune/luxury-car-bike-accident-minor-booked-yerwada-9338669/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-what-we-know-9346927/',
  'https://indianexpress.com/article/cities/pune/young-techie-killed-in-hit-and-run-accident-on-pune-ahmednagar-road-9586040/',
  'https://indianexpress.com/article/cities/pune/5-friends-killed-as-truck-overturns-on-them-on-pune-mumbai-expressway-6296403/',
  'https://indianexpress.com/article/cities/pune/mumbai-pune-expressway-accident-deaths-injured-7190701/',
  'https://indianexpress.com/article/cities/pune/pune-motorcyclist-pillion-rider-die-after-speeding-truck-hits-bike-6241789/',
  'https://indianexpress.com/article/cities/pune/one-dead-after-bus-rams-truck-on-pune-mumbai-expressway-6180343/',
  'https://indianexpress.com/article/cities/pune/on-the-eve-of-his-44th-birthday-citys-top-spine-surgeon-killed-in-road-accident-6001006/',
  'https://indianexpress.com/article/cities/pune/pune-several-injured-as-truck-runs-into-vehicles-near-navale-bridge-7397833/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-case-mother-blood-sample-accused-minor-9361131/',
  'https://indianexpress.com/article/cities/pune/injured-critically-in-accident-involving-industrial-robot-factory-employee-dies-7204970/',
  'https://indianexpress.com/article/cities/pune/couple-and-their-son-killed-in-highway-accident-in-pune-7179613/',
  'https://indianexpress.com/article/cities/pune/pune-four-killed-as-hoarding-on-rail-premises-collapses-on-road-5389117/',
  'https://indianexpress.com/article/cities/pune/pune-satara-highway-birthday-boy-among-three-friends-killed-in-accident-4-hurt-5846733/',
  'https://indianexpress.com/article/cities/pune/one-dead-after-car-knocks-down-three-on-a-bike-6432015/',
  // Bridge Chronicle fresh URLs
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-fatal-collision-road-safety-concern-agn97',
  'https://www.thebridgechronicle.com/pune/pune-accident-heavy-vehicles-turning-city-roads-into-death-traps',
  'https://www.thebridgechronicle.com/pune/repeat-drunk-driving-vehicle-seizure-pune-police-agn97',
  'https://www.thebridgechronicle.com/news/pune-two-fatal-accidents-young-biker-pedestrian-killed-speeding-vehicles-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-truck-rams-two-cars-bike-vadgaon-flyover-rider-killed',
  'https://www.thebridgechronicle.com/news/pune-speeding-school-bus-kills-two-wheeler-rider-on-karve-road',
  'https://www.thebridgechronicle.com/pune/drink-and-drive-pune-youth-crashes-near-bal-gandharva-agn97',
  'https://www.thebridgechronicle.com/pune/pune-valet-worker-killed-drunk-driving-kalyani-nagar-agn97',
  'https://www.thebridgechronicle.com/pune/eight-killed-four-injured-jejuri-morgaon-road-accident-pune-pm-modi-ex-gratia',
  'https://www.thebridgechronicle.com/news/kothrud-speeding-bike-crashes-into-paud-phata-flyover-barrier-two-college-students-dead',
  // More fresh URLs
  'https://indianexpress.com/article/cities/pune/old-pune-mumbai-highway-seven-die-in-accident-near-lonavala-5261005/',
  'https://indianexpress.com/article/cities/pune/pune-17-including-children-dead-as-truck-veers-off-highway-crashes-5131140/',
  'https://indianexpress.com/article/cities/pune/pune-two-killed-in-separate-road-accidents-7258816/',
  'https://preprod.indianexpress.com/article/cities/mumbai/6-dead-in-pune-mumbai-road-mishap-7191800/',
  'https://indianexpress.com/article/cities/pune/two-killed-one-critical-speeding-truck-hits-five-vehicles-pune-satara-highway-10160307/',
  'https://indianexpress.com/article/cities/pune/pune-mumbai-expressway-records-steady-decline-in-fatal-accidents-6283049/',
  'https://indianexpress.com/article/cities/pune/6326108pune-truck-catches-fire-on-highway-driver-dead/',
  'https://indianexpress.com/article/cities/pune/73-year-old-woman-morning-walk-killed-in-hit-and-run-on-punes-pashan-road-10495457/',
  'https://indianexpress.com/article/cities/pune/two-sisters-killed-after-truck-hits-their-two-wheeler-in-kalewadi-10474040/',
  'https://indianexpress.com/article/cities/pune/2-pune-truck-accidents-70-year-old-killed-while-returning-from-gurdwara-hit-and-run-claims-life-in-handewadi-10517775/',
  'https://indianexpress.com/article/cities/pune/pune-residents-killed-high-speed-suv-crash-limkheda-road-trip-somnath-10538584/',
  // Bridge Chronicle more URLs
  'https://www.thebridgechronicle.com/pune/pune-deadly-crash-katraj-tunnel-truck-driver-dies-passengers-injured-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-dumper-collides-eight-vehicles-katraj-dehu-road-mp99',
  'https://www.thebridgechronicle.com/pune/pune-accident-speeding-car-overturns-navale-bridge-satara-highway-agn97',
  'https://www.thebridgechronicle.com/pune/pune-mumbai-expressway-accident-khopoli-3-dead-injured-agn97',
  'https://www.thebridgechronicle.com/pune/pune-young-woman-dies-speeding-tempo-hits-two-wheeler-hirabaug-chowk-agn97',
  'https://www.thebridgechronicle.com/pune/hinjawadi-it-park-accident-speeding-bus-runs-over-two-siblings-agn97',
  'https://www.thebridgechronicle.com/pune/tamhini-ghat-fatal-crash-pune-residents-500-foot-fall-aks21',
  'https://www.thebridgechronicle.com/news/bhukum-couple-killed-in-dump-truck-motorcycle-collision-driver-flees',
  // ===== INDIAN EXPRESS 2024 =====
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-sc-bail-father-driver-police-speedy-trial-conviction-10577052/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-car-crash-supreme-court-bail-another-middleman-10540293/',
  'https://indianexpress.com/article/legal-news/supreme-court-bail-father-pune-porsche-crash-case-10574529/',
  'https://indianexpress.com/article/cities/pune/trial-pune-porsche-crash-case-next-year-10441664/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-exposed-systemic-corruption-police-commissioner-amitesh-kumar-10295060/',
  'https://indianexpress.com/article/legal-news/sc-grants-bail-to-3-accused-in-pune-porsche-crash-case-parents-responsible-for-handing-over-vehicle-to-children-10508961/',
  'https://indianexpress.com/article/cities/pune/luxury-car-bike-accident-minor-booked-yerwada-9338669/',
  'https://indianexpress.com/article/cities/pune/mumbai-expressway-turns-death-trap-in-2024-26-rise-in-deaths-9796518/',
  'https://indianexpress.com/article/cities/pune/we-are-not-living-a-normal-life-now-10007209/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-what-we-know-9346927/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-accused-fleed-vijay-mallya-nirav-modi-mumbai-9510360/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-court-allows-pune-police-to-question-10-accused-in-prison-9706932/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-tamper-secret-second-sample-minor-driver-aundh-hospital-10115652/',
  'https://indianexpress.com/article/cities/pune/young-techie-killed-in-hit-and-run-accident-on-pune-ahmednagar-road-9586040/',
  'https://indianexpress.com/article/cities/pune/one-month-porsche-crash-police-final-report-juvenile-jjb-9400373/',
  'https://indianexpress.com/article/cities/pune/two-pune-police-officers-suspended-mishandling-porsche-crash-case-9350314/',
  'https://indianexpress.com/article/cities/pune/porsche-car-crash-court-rejects-anticipatory-bail-plea-of-father-of-minor-drivers-friend-9558992/',
  'https://indianexpress.com/article/cities/pune/how-a-dinner-plan-ended-in-tragedy-for-a-group-of-friends-9341567/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-case-simulated-accident-scenario-to-be-created-using-ai-tools-to-be-submitted-as-evidence-in-court-9360099/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-two-arrested-swapping-blood-samples-minor-accused-friends-9523065/',
  'https://indianexpress.com/article/cities/pune/suv-crash-pune-nashik-drunk-minor-auto-driver-dead-9676619/',
  'https://indianexpress.com/article/cities/pune/watch-hoarding-collapses-loni-kalbhor-pune-3-men-horse-injured-9337409/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-police-to-probe-minor-boy-at-observation-home-in-pune-9364467/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-what-will-people-on-streets-do-something-needs-to-change-in-this-situation-say-judge-9343600/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-900-page-preliminary-chargesheet-filed-9478079/',
  'https://indianexpress.com/article/cities/pune/porsche-accident-minors-pubs-timings-kalyani-nagar-koregaon-park-9339159/',
  'https://indianexpress.com/article/cities/mumbai/pune-porsche-car-accident-law-equal-rich-poor-cm-9357123/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-fire-burn-injuries-9893971/',
  'https://indianexpress.com/article/cities/pune/pune-it-hub-minibus-fire-police-arrest-driver-who-started-fire-9909564/',
  // ===== INDIAN EXPRESS 2025 =====
  'https://indianexpress.com/article/cities/pune/killed-injured-pune-accident-navale-bridge-selfie-point-10363830/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-truck-was-overloaded-culpable-homicide-police-10366333/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-deep-gash-on-forehead-barely-remember-what-hit-me-10364280/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-families-recall-terrifying-crash-10365926/',
  'https://indianexpress.com/article/cities/pune/pune-rto-report-says-driver-lost-control-in-navale-bridge-accident-10384502/',
  'https://indianexpress.com/article/cities/pune/a-year-pune-porsche-case-young-lives-lost-cover-up-bribery-power-abuse-10014609/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-pune-rto-9361795/',
  'https://indianexpress.com/article/cities/pune/two-killed-one-critical-speeding-truck-hits-five-vehicles-pune-satara-highway-10160307/',
  'https://indianexpress.com/article/cities/pune/mumbai-pune-expressway-truck-crash-luxury-car-crash-dead-victims-live-10151730/',
  'https://indianexpress.com/article/cities/pune/10-women-killed-in-pune-road-mishap-10183690/',
  'https://indianexpress.com/article/cities/pune/bridge-collapse-pune-indrayani-river-10068179/',
  'https://indianexpress.com/article/cities/pune/pune-23-year-old-student-killed-in-road-accident-in-lohegaon-10032686/',
  'https://indianexpress.com/article/cities/pune/road-accident-hadapsar-kills-boy-driver-held-9914926/',
  'https://indianexpress.com/article/cities/pune/pune-hit-and-run-suv-driver-arrested-morning-walker-accident-death-9919515/',
  'https://indianexpress.com/article/cities/pune/three-injured-after-pmpml-bus-crashes-7-vehicles-brake-failure-suspected-9973279/',
  'https://indianexpress.com/article/cities/pune/bus-climbs-footpath-hinjewadi-crushes-two-schoolchildren-10396677/',
  'https://indianexpress.com/article/cities/pune/hit-and-run-accident-kills-morning-walker-in-pune-undri-locals-call-for-more-speed-bumps-9918694/',
  'https://indianexpress.com/article/cities/pune/tamhini-ghat-gorge-suv-konkan-trip-dead-10376869/',
  'https://indianexpress.com/article/cities/pune/vehicles-collide-road-mishap-bhumkar-chowk-no-casualties-10371194/',
  'https://indianexpress.com/article/cities/pune/1-5-year-old-run-over-by-water-tanker-pune-reverse-police-arrest-9927988/',
  'https://indianexpress.com/article/cities/pune/tempo-driver-killed-four-vehicles-crash-old-pune-mumbai-highway-10022787/',
  'https://indianexpress.com/article/cities/pune/10-hurt-private-bus-bypass-pune-9905696/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-vehicles-accident-9178561/',
  'https://indianexpress.com/article/cities/pune/pune-porsche-crash-police-dismiss-service-dereliction-duty-10413046/',
  'https://indianexpress.com/article/cities/pune/road-accident-victims-in-car-were-returning-from-narayanpur-temple-10364378/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-truck-driver-cleaner-vehicle-owner-rajasthan-booked-culpable-homicide-10364898/',
  'https://indianexpress.com/article/cities/pune/pune-woman-booked-for-73-yr-olds-death-in-road-accident-10169720/',
  'https://indianexpress.com/article/cities/pune/woman-pilgrim-killed-10-injured-as-speeding-truck-ploughs-into-warkari-procession-on-old-pune-mumbai-highway-10358825/',
  'https://indianexpress.com/article/cities/pune/pune-lawyer-dies-speeding-car-rams-motorcycle-driver-arrested-10010142/',
  'https://indianexpress.com/article/cities/pune/pune-drunk-it-professional-rams-car-into-pubs-parking-valet-attendant-dead-10395022/',
  'https://indianexpress.com/article/cities/pune/pune-23-year-old-student-killed-in-road-accident-in-lohegaon-10032686/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-school-bus-hits-car-injured-10409561/',
  'https://indianexpress.com/article/cities/pune/cyber-security-expert-killed-accident-pune-mumbai-expressway-9940779/',
  'https://indianexpress.com/article/cities/pune/mercedes-crash-bike-pune-wadgaon-bridge-death-9980240/',
  'https://indianexpress.com/article/cities/pune/woman-dies-after-dumper-carrying-gravel-for-pune-ring-road-plunges-into-house-10539612/',
  'https://indianexpress.com/article/cities/pune/tempo-truck-rams-into-police-jeep-on-pune-mumbai-highway-3-metro-wardens-injured-driver-held-10084132/',
  'https://indianexpress.com/article/cities/pune/7-dead-van-carrying-devotees-crashes-30-feet-down-in-khed-10182918/',
  // ===== INDIAN EXPRESS 2022-2023 =====
  'https://indianexpress.com/article/cities/pune/two-black-spots-in-the-area-saw-31-deaths-108-accidents-in-past-5-yrs-8281801/',
  'https://indianexpress.com/article/cities/pune/navale-bridge-accident-highlights-traffic-management-infrastructure-woes-on-katraj-dehu-road-bypass-8281620/',
  'https://indianexpress.com/article/cities/pune/pune-56-mishaps-involving-pmpml-buses-in-2019-least-in-5-years-6227053/',
  'https://indianexpress.com/article/cities/pune/fatalities-on-old-mumbai-pune-highway-drop-by-54-since-2018-7586183/',
  'https://indianexpress.com/article/cities/pune/old-mumbai-pune-highway-road-acciedents-deaths-down-by-54-says-study-7587326/',
  'https://indianexpress.com/article/cities/pune/pune-truck-accident-no-brake-failure-driver-turned-off-ignition-to-save-fuel-say-police-after-rto-assessment-8280342/',
  'https://indianexpress.com/article/cities/india/ncrb-report-deaths-in-road-accidents-up-by-17-pc-8119743/',
  'https://indianexpress.com/article/cities/pune/mumbai-bangalore-highway-bus-truck-accident-deaths-injuries-8570932/',
  'https://indianexpress.com/article/cities/pune/kundamala-bridge-collapse-i-saw-the-bridge-bending-survivors-and-injured-in-hospitals-recall-horror-10068903/',
  'https://indianexpress.com/article/cities/pune/kundamala-bridge-collapse-i-saw-the-bridge-bending-survivors-and-injured-in-hospitals-recall-horror/',
  'https://indianexpress.com/article/cities/pune/40-vehicles-pile-up-several-injured-the-aftermath-of-punes-truck-accident-8280659/',
  'https://indianexpress.com/article/cities/pune/six-injured-as-truck-with-suspected-brake-failure-rams-several-vehicles-in-pune-8279802/',
  'https://indianexpress.com/article/cities/pune/caution-drive-safely-ten-trauma-hotspots-identified-in-pune-8991618/',
  'https://indianexpress.com/article/cities/pune/in-15-months-26-killed-in-161-bus-accidents-pune-transport-body8877390/',
  'https://indianexpress.com/article/cities/pune/29-injured-in-head-on-collision-of-2-pmpml-buses-on-pune-ahmednagar-road-8871420/',
  'https://indianexpress.com/article/cities/pune/mumbai-bengaluru-highway-bus-truck-accident-deaths-injuries-8570932/',
  'https://indianexpress.com/article/cities/pune/12-injured-in-pune-as-bus-veers-off-mumbai-bengaluru-highway-falls-15-feet-8506134/',
  'https://indianexpress.com/article/cities/pune/one-dead-three-injured-as-bus-sliding-back-hits-six-vehicles-8621698/',
  'https://indianexpress.com/article/cities/pune/tempo-hits-two-wheeler-2-cars-on-highway-10-injured-8686068/',
  'https://indianexpress.com/article/cities/pune/maharashtra-bus-accident-family-pune-found-in-tight-embrace-8695847/',
  'https://indianexpress.com/article/cities/pune/mumbai-nagpur-expressway-accident-among-those-dead-3-members-each-of-2-families-8696569/',
  // ===== INDIAN EXPRESS 2026 =====
  'https://indianexpress.com/article/cities/pune/tragedy-on-pune-solapur-highway-3-killed-tyre-burst-flings-muv-into-opposite-lane-10586331/',
  'https://indianexpress.com/article/cities/pune/rural-nashik-pune-report-most-severe-road-accidents-10472980/',
  'https://indianexpress.com/article/cities/pune/pune-road-crash-deaths-down-15-but-pedestrians-two-wheeler-riders-account-for-90-of-fatalities-10463000/',
  'https://indianexpress.com/article/cities/pune/pune-mumbai-expressway-accident-survivors-trauma-bmw-truck-crash-9798563/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-vehicles-accident-9178561/',
  'https://indianexpress.com/article/cities/pune/4-injured-suv-3-vehicles-pune-mumbai-highway-techie-driver-9702837/',
  'https://indianexpress.com/article/cities/pune/young-techie-killed-in-hit-and-run-accident-on-pune-ahmednagar-road-9586040/',
  'https://indianexpress.com/article/cities/pune/73-year-old-woman-morning-walk-killed-in-hit-and-run-on-punes-pashan-road-10495457/',
  'https://indianexpress.com/article/cities/pune/two-sisters-killed-after-truck-hits-their-two-wheeler-in-kalewadi-10474040/',
  'https://indianexpress.com/article/cities/pune/2-pune-truck-accidents-70-year-old-killed-while-returning-from-gurdwara-hit-and-run-claims-life-in-handewadi-10517775/',
  'https://indianexpress.com/article/cities/pune/pune-residents-killed-high-speed-suv-crash-limkheda-road-trip-somnath-10538584/',
  // ===== BRIDGE CHRONICLE MORE =====
  'https://www.thebridgechronicle.com/pune/pune-police-officers-dismissed-porsche-case-investigation-lapses-agn97',
  'https://www.thebridgechronicle.com/news/pune-police-seek-dismissal-of-suspended-officers-in-porsche-car-hit-and-run-case',
  'https://www.thebridgechronicle.com/pune/juvenile-board-rejects-plea-to-try-teen-as-adult-kalyaninagar-porsche-crash',
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-fatal-collision-road-safety-concern-agn97',
  'https://www.thebridgechronicle.com/pune/pune-accident-heavy-vehicles-turning-city-roads-into-death-traps',
  'https://www.thebridgechronicle.com/pune/repeat-drunk-driving-vehicle-seizure-pune-police-agn97',
  'https://www.thebridgechronicle.com/news/pune-two-fatal-accidents-young-biker-pedestrian-killed-speeding-vehicles-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-truck-rams-two-cars-bike-vadgaon-flyover-rider-killed',
  'https://www.thebridgechronicle.com/pune/pune-deadly-crash-katraj-tunnel-truck-driver-dies-passengers-injured-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-dumper-collides-eight-vehicles-katraj-dehu-road-mp99',
  'https://www.thebridgechronicle.com/pune/pune-accident-speeding-car-overturns-navale-bridge-satara-highway-agn97',
  'https://www.thebridgechronicle.com/pune/pune-mumbai-expressway-accident-khopoli-3-dead-injured-agn97',
  'https://www.thebridgechronicle.com/pune/pune-young-woman-dies-speeding-tempo-hits-two-wheeler-hirabaug-chowk-agn97',
  'https://www.thebridgechronicle.com/pune/hinjawadi-it-park-accident-speeding-bus-runs-over-two-siblings-agn97',
  'https://www.thebridgechronicle.com/pune/tamhini-ghat-fatal-crash-pune-residents-500-foot-fall-aks21',
  'https://www.thebridgechronicle.com/news/bhukum-couple-killed-in-dump-truck-motorcycle-collision-driver-flees',
  'https://www.thebridgechronicle.com/pune/pune-bridge-collapse-four-dead-50-injured-maval',
  'https://www.thebridgechronicle.com/pune/eight-killed-four-injured-jejuri-morgaon-road-accident-pune-pm-modi-ex-gratia',
  'https://www.thebridgechronicle.com/pune/pune-container-rams-five-vehicles-pune-satara-highway-five-injured-two-critical',
  'https://www.thebridgechronicle.com/pune/msrtc-driver-killed-nine-injured-pune-mumbai-expressway-accident-lonavala',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-deadly-collision-between-two-st-buses-leaves-1-dead-69-injured',
  'https://www.thebridgechronicle.com/news/father-and-son-killed-in-highway-collision-3-family-members-critically-injured',
  'https://www.thebridgechronicle.com/news/wagholi-speeding-dumper-kills-woman-on-pune-nagar-highway-husband-injured',
  'https://www.thebridgechronicle.com/news/junnar-two-dead-18-injured-in-bus-car-collision-on-nagar-kalyan-highway',
  'https://www.thebridgechronicle.com/news/chakan-shikrapur-road-accident-speeding-truck-claims-lives-of-father-and-two-young-sons',
  'https://www.thebridgechronicle.com/news/hinjewadi-two-software-engineers-killed-in-motorcycle-accident',
  'https://www.thebridgechronicle.com/news/kothrud-speeding-bike-crashes-into-paud-phata-flyover-barrier-two-college-students-dead',
  'https://www.thebridgechronicle.com/news/husband-and-wife-die-in-car-accident-on-pune-nashik-highway-one-seriously-injured',
  'https://www.thebridgechronicle.com/news/pune-police-crackdown-heavy-vehicles-fatal-accidents',
  'https://www.thebridgechronicle.com/news/brake-failure-leads-pmpml-bus-to-crash-in-dhayari-no-injuries-reported',
  'https://www.thebridgechronicle.com/news/moshi-hit-and-run-police-officers-son-booked-after-cctv-footage-goes-viral',
  // ===== NEW FRESH URLS - Indian Express =====
  'https://indianexpress.com/article/cities/pune/tragedy-on-pune-solapur-highway-3-killed-tyre-burst-flings-muv-into-opposite-lane-10586331/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-exposed-systemic-corruption-police-commissioner-amitesh-kumar-10295060/',
  'https://indianexpress.com/article/cities/pune/killed-injured-pune-accident-navale-bridge-selfie-point-10363830/',
  'https://indianexpress.com/article/cities/pune/pune-rto-report-says-driver-lost-control-in-navale-bridge-accident-10384502/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-truck-was-overloaded-culpable-homicide-police-10366333/',
  'https://indianexpress.com/article/cities/pune/pune-navale-bridge-accident-families-recall-terrifying-crash-10365926/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-deep-gash-on-forehead-barely-remember-what-hit-me-10364280/',
  'https://indianexpress.com/article/cities/pune/porsche-crash-case-sc-bail-father-driver-police-speedy-trial-conviction-10577052/',
  'https://indianexpress.com/article/cities/pune/almost-a-month-after-wife-dies-in-pune-road-accident-guitarist-husband-booked-for-negligence-10507574/',
  'https://indianexpress.com/article/cities/pune/2-pune-truck-accidents-70-year-old-killed-while-returning-from-gurdwara-hit-and-run-claims-life-in-handewadi-10517775/',
  'https://indianexpress.com/article/cities/pune/pune-road-crash-deaths-down-15-but-pedestrians-two-wheeler-riders-account-for-90-of-fatalities-10463000/',
  'https://indianexpress.com/article/cities/pune/hit-and-run-accident-kills-morning-walker-in-pune-undri-locals-call-for-more-speed-bumps-9918694/',
  'https://indianexpress.com/article/cities/pune/pune-hit-and-run-suv-driver-arrested-morning-walker-accident-death-9919515/',
  'https://indianexpress.com/article/cities/pune/road-accident-hadapsar-kills-boy-driver-held-9914926/',
  'https://indianexpress.com/article/cities/pune/pune-tempo-fire-burn-injuries-9893971/',
  'https://indianexpress.com/article/cities/pune/three-injured-after-pmpml-bus-crashes-7-vehicles-brake-failure-suspected-9973279/',
  'https://indianexpress.com/article/cities/pune/vehicles-collide-road-mishap-bhumkar-chowk-no-casualties-10371194/',
  'https://indianexpress.com/article/cities/pune/10-women-killed-in-pune-road-mishap-10183690/',
  'https://indianexpress.com/article/cities/pune/old-man-dies-two-wheeler-skids-roadside-aundh-10164289/',
  'https://indianexpress.com/article/cities/pune/pune-drunk-it-professional-rams-car-into-pubs-parking-valet-attendant-dead-10395022/',
  'https://indianexpress.com/article/cities/pune/bus-climbs-footpath-hinjewadi-crushes-two-schoolchildren-10396677/',
  'https://indianexpress.com/article/cities/pune/pune-road-accident-victims-in-car-were-returning-from-narayanpur-temple-10364378/',
  'https://indianexpress.com/article/cities/pune/two-killed-one-critical-speeding-truck-hits-five-vehicles-pune-satara-highway-10160307/',
  'https://indianexpress.com/article/cities/pune/bridge-collapse-pune-indrayani-river-10068179/',
  'https://indianexpress.com/article/cities/pune/kundamala-bridge-collapse-i-saw-the-bridge-bending-survivors-and-injured-in-hospitals-recall-horror-10068903/',
  'https://indianexpress.com/article/cities/pune/pune-23-year-old-student-killed-in-road-accident-in-lohegaon-10032686/',
  // ===== NEW FRESH URLS - Bridge Chronicle =====
  'https://www.thebridgechronicle.com/pune/pune-five-year-old-dies-school-bus-accident-driver-school-officials-booked-agn97',
  'https://www.thebridgechronicle.com/pune/hinjawadi-it-park-accident-speeding-bus-runs-over-two-siblings-agn97',
  'https://www.thebridgechronicle.com/pune/eight-killed-four-injured-jejuri-morgaon-road-accident-pune-pm-modi-ex-gratia',
  'https://www.thebridgechronicle.com/pune/pune-hinjawadi-young-woman-killed-dumper-bike-accident-agn97',
  'https://www.thebridgechronicle.com/news/pune-two-fatal-accidents-young-biker-pedestrian-killed-speeding-vehicles-agn97',
  'https://www.thebridgechronicle.com/pune/pune-speeding-car-crashes-into-metro-pillar-three-dead-agn97',
  'https://www.thebridgechronicle.com/pune/pune-police-officers-dismissed-porsche-case-investigation-lapses-agn97',
  'https://www.thebridgechronicle.com/news/pune-woman-dies-tree-falls-autorickshaw-monsoon',
  'https://www.thebridgechronicle.com/pune/deadly-pune-roads-290-deaths-two-wheeler-pedestrians-agn97',
  'https://www.thebridgechronicle.com/news/kothrud-speeding-bike-crashes-into-paud-phata-flyover-barrier-two-college-students-dead',
  'https://www.thebridgechronicle.com/news/pune-accident-13-year-old-boy-dies-locals-assault-driver-2025',
  'https://www.thebridgechronicle.com/pune/pune-navale-bridge-fatal-collision-road-safety-concern-agn97',
  'https://www.thebridgechronicle.com/pune/pune-woman-dies-rock-falls-through-sunroof-tamhini-ghat-agn97',
  'https://www.thebridgechronicle.com/news/pune-birthday-party-ends-in-tragedy-swift-car-crashes-into-bus-two-dead-four-injured',
  'https://www.thebridgechronicle.com/pune/pune-bus-truck-accident-university-road-traffic-jam-agn97',
  'https://www.thebridgechronicle.com/pune/speeding-truck-rams-two-cars-bike-vadgaon-flyover-rider-killed',
  'https://www.thebridgechronicle.com/pune/pune-container-rams-five-vehicles-pune-satara-highway-five-injured-two-critical',
  'https://www.thebridgechronicle.com/pune/msrtc-driver-killed-nine-injured-pune-mumbai-expressway-accident-lonavala',
  'https://www.thebridgechronicle.com/news/sadashiv-peth-car-accident-injured-students-exam-postponement',
  'https://www.thebridgechronicle.com/pune/pune-kalepadal-drunk-driving-accident-agn97',
  'https://www.thebridgechronicle.com/pune/pune-young-woman-dies-speeding-tempo-hits-two-wheeler-hirabaug-chowk-agn97',
  'https://www.thebridgechronicle.com/news/pune-speeding-school-bus-kills-two-wheeler-rider-on-karve-road',
  'https://www.thebridgechronicle.com/pune/navale-bridge-accident-pune-six-month-road-safety-overhaul-agn97',
  'https://www.thebridgechronicle.com/pune/pune-4-year-old-girl-critical-ncp-mla-dnyaneshwar-katke-car-agn97',
  'https://www.thebridgechronicle.com/pune/pune-accident-heavy-vehicles-turning-city-roads-into-death-traps',
  'https://www.thebridgechronicle.com/pune/three-killed-two-children-injured-road-accidents-pune',
  'https://www.thebridgechronicle.com/news/heavy-vehicle-ban-violated-beauty-parlor-trainee-killed-as-dumper-hits-two-wheeler-in-baner',
  'https://www.thebridgechronicle.com/news/dashcam-captures-car-losing-control-crashing-into-two-bikers-in-wakad',
  'https://www.thebridgechronicle.com/news/pune-accident-who-is-responsible-for-road-death',
  'https://www.thebridgechronicle.com/pune/tamhini-ghat-fatal-crash-pune-residents-500-foot-fall-aks21',
  'https://www.thebridgechronicle.com/news/pune-police-seek-dismissal-of-suspended-officers-in-porsche-car-hit-and-run-case',
  'https://www.thebridgechronicle.com/news/pune-solapur-highway-accident-container-truck-traffic-jam-2025',
  'https://www.thebridgechronicle.com/pune/cyclists-collide-pune-grand-cycle-tour-narrow-road-statement-mp99',
  'https://www.thebridgechronicle.com/pune/pune-valet-worker-killed-drunk-driving-kalyani-nagar-agn97',
  'https://www.thebridgechronicle.com/pune/pune-bridge-collapse-four-dead-50-injured-maval',
  'https://www.thebridgechronicle.com/pune/pune-crane-trailer-overturns-mundhwa-bridge-traffic-disruption-agn97',
];

class DeduplicationStore {
  constructor() {
    this.filePath = path.join(BASE_DIR, 'seen_hashes.json');
    this.hashes = this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      return new Set(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')));
    }
    return new Set();
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify([...this.hashes], null, 2));
  }

  generateHash(title, date, content) {
    const str = `${(title || '').toLowerCase().trim()}|${(date || '').toLowerCase().trim()}|${(content || '').substring(0, 200).toLowerCase()}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  isSeen(article) {
    const hash = this.generateHash(article.title, article.date?.raw, article.content);
    return this.hashes.has(hash);
  }

  markSeen(article) {
    const hash = this.generateHash(article.title, article.date?.raw, article.content);
    this.hashes.add(hash);
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch(url) {
  try {
    const profile = BROWSER_PROFILES[0];
    const response = await axios.get(url, { 
      timeout: 20000,
      headers: { ...profile.headers, 'User-Agent': profile.userAgent },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
    return response.status === 200 ? response.data : null;
  } catch (error) {
    return null;
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return {
        raw: dateStr,
        iso: date.toISOString(),
        year: date.getFullYear(),
        formatted: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      };
    }
  } catch (e) {}
  
  const yearMatch = dateStr.match(/\b(201[89]|202[0-6])\b/);
  if (yearMatch) {
    return { raw: dateStr, year: parseInt(yearMatch[1]) };
  }
  return { raw: dateStr };
}

function isRoadAccidentArticle(title, content, url) {
  const text = `${title} ${content} ${url}`.toLowerCase();
  const keywords = ['road accident', 'car accident', 'truck accident', 'bike accident', 'motorcycle', 
    'highway accident', 'expressway', 'traffic accident', 'hit and run', 'driver killed',
    'vehicle collision', 'crash', 'accident near', 'accident in pune', 'pune accident', 
    'rider killed', 'pedestrian killed', 'two-wheeler', 'truck hits', 'car hits', 
    'motorcyclist', 'road crash', 'collision', 'overturns', 'falls from', 'plunges',
    'flyover accident', 'bridge accident', 'signal accident', 'speeding', 'drunk driving',
    'killed in', 'dies in', 'death in', 'porsche', 'killed', 'injured'];
  
  const excludeKeywords = ['earthquake', 'building collapse', 'train accident', 
    'plane crash', 'aircraft crash', 'drowning', 'electrocution', 'suicide', 'murder',
    'stabbing', 'assault'];
  
  const hasKeyword = keywords.some(kw => text.includes(kw));
  const hasExclude = excludeKeywords.some(kw => text.includes(kw));
  
  return hasKeyword && !hasExclude;
}

async function scrapeArticle(url) {
  const html = await fetch(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  
  let title = $('h1').first().text().trim() || 
              $('meta[property="og:title"]').attr('content') || '';
  
  if (!title || title.length < 10) return null;

  const content = [];
  $('p').each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 50 && !text.includes('Read Now') && !text.includes('Subscribe') &&
        !text.includes('Premium') && !text.includes('Sign in')) {
      content.push(text);
    }
  });

  if (content.length < 3) return null;

  let dateStr = $('time').attr('datetime') || 
                $('meta[property="article:published_time"]').attr('content') ||
                $('[class*="date"]').first().text().trim() ||
                $('[class*="publish"]').first().text().trim() || '';
  
  const date = parseDate(dateStr);
  const fullContent = content.join('\n\n');
  
  if (!isRoadAccidentArticle(title, fullContent, url)) {
    return null;
  }

  return {
    url,
    title: title.trim(),
    date,
    author: '',
    summary: $('meta[name="description"]').attr('content') || fullContent.substring(0, 300),
    content: fullContent,
    scrapedAt: new Date().toISOString()
  };
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE SCRAPER v4');
  console.log('='.repeat(60));
  console.log('');

  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }

  const dedup = new DeduplicationStore();
  const yearData = {};
  YEARS.forEach(y => yearData[y] = []);
  
  for (const year of YEARS) {
    const yearFile = path.join(BASE_DIR, String(year), 'pune_road_accidents.json');
    if (fs.existsSync(yearFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(yearFile, 'utf-8'));
        if (data.articles && data.articles.length > 0) {
          yearData[year] = [...data.articles];
          data.articles.forEach(a => dedup.markSeen(a));
          console.log(`Loaded ${data.articles.length} existing articles from ${year}`);
        }
      } catch (e) {}
    }
  }
  
  const uniqueUrls = [...new Set(ALL_URLS)];
  console.log(`Total URLs to scrape: ${uniqueUrls.length}\n`);

  let totalScraped = 0;
  let failed = 0;
  
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    
    process.stdout.write(`[${i + 1}/${uniqueUrls.length}] `);
    
    const article = await scrapeArticle(url);
    
    if (article && article.date?.year) {
      const year = article.date.year;
      
      if (YEARS.includes(year)) {
        if (yearData[year].length < TARGET_MAX) {
          if (!dedup.isSeen(article)) {
            dedup.markSeen(article);
            yearData[year].push(article);
            console.log(`✓ (${year}) - ${article.title.substring(0, 45)}...`);
            totalScraped++;
          } else {
            console.log(`- Duplicate`);
          }
        } else {
          console.log(`- Year ${year} full`);
        }
      } else {
        console.log(`- Year ${year} not in scope`);
      }
    } else if (article) {
      console.log(`- Not road accident or no date`);
    } else {
      failed++;
      console.log(`✗ Failed`);
    }
    
    await delay(1000);
  }

  dedup.save();

  console.log('\n' + '='.repeat(60));
  console.log('SAVING DATA');
  console.log('='.repeat(60));

  for (const year of YEARS) {
    const dir = path.join(BASE_DIR, String(year));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (yearData[year].length > 0) {
      const outputPath = path.join(dir, 'pune_road_accidents.json');
      const data = {
        source: 'Comprehensive Scraper',
        topic: 'Pune Road Accidents',
        year,
        totalArticles: yearData[year].length,
        scrapedAt: new Date().toISOString(),
        articles: yearData[year]
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`✓ Saved ${yearData[year].length} articles for ${year}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total new articles scraped: ${totalScraped}`);
  console.log(`Failed URLs: ${failed}`);
  console.log(`Total unique hashes tracked: ${dedup.hashes.size}`);
  YEARS.forEach(y => console.log(`  ${y}: ${yearData[y].length} articles`));
  console.log('='.repeat(60));
}

main().catch(console.error);
