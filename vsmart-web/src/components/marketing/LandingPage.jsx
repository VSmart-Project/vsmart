import {
  Sparkle,
  MapPinLine,
  ShieldCheck,
  ClockCounterClockwise,
  Lightning,
  CloudArrowUp,
  LockKey,
  DeviceMobile,
  Motorcycle,
} from '@phosphor-icons/react';
import MapBackdrop, { TrackedRoute, VehicleOnPath } from './MapBackdrop';

const DIRECTION_CONTRACT = `
THESIS: Channels the user's own reference app (archflow-app): a calm,
muted-indigo SaaS system with mono eyebrow labels, soft panel shadows, and a
sparing gradient accent, rather than any of the three previously rejected
directions.
OWN-WORLD: Backgrounds f6f7f9/16161b, cards white/222229, one muted indigo
accent (6664d8/8d8ae8), system-ui sans throughout, mono for eyebrow labels
only, soft diffused shadows, rounded-lg/xl/2xl scale.
STORY: An owner reads a mono eyebrow, a two-line headline with one gradient
accent clause, a short flow of three real capabilities beside a real photo,
then signs up.
FIRST VIEWPORT: Split hero, eyebrow plus two-line headline plus subtext plus
one CTA on the left, a real photograph in a bordered card on the right.
FORM: Direct extraction from the user-supplied reference project's design
tokens and component patterns (button.tsx, auth-shell.tsx, globals.css).
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md.
`;

function DirectionContract() {
  return <div dangerouslySetInnerHTML={{ __html: `<!-- ${DIRECTION_CONTRACT} -->` }} />;
}

const PRIMARY_CTA = 'Start protecting your vehicle';

const SURFACE = 'bg-[#f6f7f9] dark:bg-[#16161b]';
const CARD = 'bg-white dark:bg-[#222229]';
const TEXT = 'text-[#202124] dark:text-[#f3f3f5]';
const MUTED = 'text-[#687080] dark:text-[#a4a4af]';
const BORDER = 'border-[#dfe2e8] dark:border-[#3a3a44]';
const PRIMARY_TEXT = 'text-[#6664d8] dark:text-[#8d8ae8]';
const PRIMARY_BG = 'bg-[#6664d8] dark:bg-[#8d8ae8]';
const PANEL_SHADOW = 'shadow-[0_14px_44px_rgba(31,35,44,0.08)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.24)]';

function IconTile({ icon }) {
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${BORDER} ${CARD} ${PRIMARY_TEXT} shadow-sm`}>
      {icon}
    </span>
  );
}

function FlowItem({ icon, title, detail }) {
  return (
    <div className="flex items-center gap-4">
      <IconTile icon={icon} />
      <div>
        <p className={`text-sm font-medium ${TEXT}`}>{title}</p>
        <p className={`mt-0.5 text-xs ${MUTED}`}>{detail}</p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid size-7 place-items-center rounded-md ${PRIMARY_BG}`}>
        <Lightning className="size-4 text-white" weight="fill" />
      </span>
      <span className={`font-semibold tracking-tight ${TEXT}`}>Vsmart</span>
    </div>
  );
}

function Nav({ onGetStarted }) {
  return (
    <div className="mx-auto max-w-[1180px] px-5 sm:px-8 h-16 flex items-center justify-between">
      <Logo />
      <button
        onClick={onGetStarted}
        className="text-sm font-medium text-[#687080] dark:text-[#a4a4af] hover:text-[#202124] dark:hover:text-[#f3f3f5] transition-colors"
      >
        Sign in
      </button>
    </div>
  );
}

function Hero({ onGetStarted }) {
  return (
    <header className={SURFACE}>
      <Nav onGetStarted={onGetStarted} />

      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 lg:py-14 grid lg:grid-cols-[1fr_460px] gap-12 lg:gap-16 items-center">
        <section>
          <div className={`mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.17em] ${PRIMARY_TEXT}`}>
            <Sparkle className="size-3.5" weight="fill" />
            Real-time vehicle security
          </div>

          <h1 className={`text-4xl lg:text-5xl font-semibold leading-[1.08] tracking-[-0.03em] ${TEXT}`}>
            Real-time location.{' '}
            <span className="bg-gradient-to-r from-[#6664d8] to-[#198fa4] dark:from-[#8d8ae8] dark:to-[#58b8c7] bg-clip-text text-transparent">
              Instant theft alerts.
            </span>
          </h1>

          <p className={`mt-5 max-w-md text-[15px] leading-7 ${MUTED}`}>
            Vsmart Tracking shows your vehicle's exact position live and
            alerts you the instant it leaves a protected zone.
          </p>

          <div className="mt-8">
            <button
              onClick={onGetStarted}
              className={`h-11 px-6 rounded-xl ${PRIMARY_BG} text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80`}
            >
              {PRIMARY_CTA}
            </button>
          </div>

          <div className="mt-10 space-y-4">
            <FlowItem
              icon={<MapPinLine className="size-4" />}
              title="Live location"
              detail="See your vehicle move on the map in real time"
            />
            <FlowItem
              icon={<ShieldCheck className="size-4" />}
              title="Automatic protection"
              detail="A safe zone appears the moment you park"
            />
            <FlowItem
              icon={<ClockCounterClockwise className="size-4" />}
              title="Full history"
              detail="Replay any day's route, matched to the real road"
            />
          </div>
        </section>

        <section className={`relative rounded-2xl overflow-hidden border ${BORDER} ${PANEL_SHADOW} aspect-[4/5] lg:aspect-[3/4] ${CARD}`}>
          <MapBackdrop className="absolute inset-0 w-full h-full" viewBox="0 0 460 560">
            <TrackedRoute
              path="M60,500 L60,380 L220,380 L220,220 L140,220 L140,80 L360,80 L360,300 L400,300"
              duration={9}
            />
            <VehicleOnPath
              path="M60,500 L60,380 L220,380 L220,220 L140,220 L140,80 L360,80 L360,300 L400,300"
              duration={9}
              vehicle="motorbike"
              scale={1.4}
            />
          </MapBackdrop>

          {/* Floating live-status readout, anchored over the map like the real app UI */}
          <div className={`absolute bottom-4 left-4 right-4 rounded-xl border ${BORDER} ${CARD} ${PANEL_SHADOW} px-4 py-3 flex items-center gap-3`}>
            <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/10">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <span className="relative size-2 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${TEXT}`}>Vehicle-001 is moving</p>
              <p className={`font-mono text-[10px] ${MUTED}`}>10.8481, 106.7864 · updated just now</p>
            </div>
          </div>
        </section>
      </div>

      <div className={`border-t ${BORDER}`}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-4">
          <span className={`text-xs font-medium ${MUTED}`}>
            Powered by AWS Lambda, IoT Core, and Location Service
          </span>
        </div>
      </div>
    </header>
  );
}

function Mechanism() {
  return (
    <section id="how-it-works" className={`py-20 ${CARD} border-y ${BORDER}`}>
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <div className={`rounded-2xl overflow-hidden border ${BORDER} ${SURFACE}`}>
          <MapBackdrop className="w-full h-auto">
            <TrackedRoute path="M60,200 L200,200 L200,80 L420,80 L420,320 L560,320" duration={7} />
            <VehicleOnPath
              path="M60,200 L200,200 L200,80 L420,80 L420,320 L560,320"
              duration={7}
              vehicle="car"
            />
          </MapBackdrop>
        </div>

        <div>
          <h2 className={`text-3xl font-semibold tracking-[-0.02em] leading-tight ${TEXT}`}>
            No refresh needed.
          </h2>
          <p className={`mt-4 max-w-md text-[15px] leading-7 ${MUTED}`}>
            The moment your vehicle moves or triggers an alert, the update
            reaches your phone immediately, without polling or a manual
            refresh.
          </p>

          <div className="mt-9 space-y-6">
            <FlowItem
              icon={<Lightning className="size-4" />}
              title="Live, event-driven updates"
              detail="Position changes and alerts stream to your device the moment they happen"
            />
            <FlowItem
              icon={<MapPinLine className="size-4" />}
              title="Road-matched positions"
              detail="Raw GPS noise is matched onto the real road network"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AntiTheft() {
  return (
    <section className={`py-20 ${SURFACE}`}>
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <h2 className={`text-3xl font-semibold tracking-[-0.02em] leading-tight ${TEXT}`}>
          Automatic protection while it's parked.
        </h2>
        <p className={`mt-4 max-w-xl mx-auto text-[15px] leading-7 ${MUTED}`}>
          Turn on anti-theft and a safe zone appears around your vehicle
          immediately. If it moves outside that zone, you're alerted right
          away, and protection disarms itself afterward.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
          <div className={`rounded-2xl p-7 border ${BORDER} ${CARD} ${PANEL_SHADOW}`}>
            <span className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 mb-4">
              <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" weight="bold" />
            </span>
            <p className={`text-sm font-medium ${TEXT}`}>Protected, parked</p>
            <p className={`mt-1 text-sm ${MUTED}`}>Safe zone active. No movement detected.</p>
          </div>
          <div className={`rounded-2xl p-7 border border-rose-500/20 ${CARD} ${PANEL_SHADOW}`}>
            <span className="grid size-10 place-items-center rounded-lg bg-rose-500/10 mb-4">
              <ShieldCheck className="size-5 text-rose-600 dark:text-rose-400" weight="bold" />
            </span>
            <p className={`text-sm font-medium ${TEXT}`}>Breach detected</p>
            <p className={`mt-1 text-sm ${MUTED}`}>Alert sent to your phone instantly.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function History() {
  return (
    <section className={`py-20 ${CARD} border-y ${BORDER}`}>
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <div className="order-2 lg:order-1">
          <h2 className={`text-3xl font-semibold tracking-[-0.02em] leading-tight ${TEXT}`}>
            Every trip, ready to replay.
          </h2>
          <p className={`mt-4 max-w-md text-[15px] leading-7 ${MUTED}`}>
            Scroll back through any day and watch the route unfold, matched
            cleanly onto the real road.
          </p>
        </div>

        <div className={`order-1 lg:order-2 rounded-2xl overflow-hidden border ${BORDER} ${SURFACE}`}>
          <img
            src="https://picsum.photos/seed/vsmart-phone-map/900/700"
            alt="A hand holding a phone showing a map application"
            className="w-full h-56 object-cover"
          />
          <MapBackdrop className="w-full h-auto" viewBox="0 0 600 200">
            <TrackedRoute path="M50,150 L50,100 L220,100 L220,40 L400,40 L400,90 L550,90" duration={10} />
            <VehicleOnPath
              path="M50,150 L50,100 L220,100 L220,40 L400,40 L400,90 L550,90"
              duration={10}
              vehicle="motorbike"
              scale={0.9}
            />
          </MapBackdrop>
          <div className={`px-5 py-4 flex items-center gap-3 border-t ${BORDER}`}>
            <span className={`font-mono text-[10px] ${MUTED}`}>06:00</span>
            <div className={`flex-1 h-1.5 rounded-full ${BORDER} bg-[#eceef2] dark:bg-[#2d2d35]`}>
              <div className={`h-full rounded-full ${PRIMARY_BG}`} style={{ width: '62%' }} />
            </div>
            <span className={`font-mono text-[10px] ${MUTED}`}>21:30</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Facts() {
  const groups = [
    {
      heading: 'Infrastructure',
      items: [
        { icon: <CloudArrowUp className="size-4" />, title: 'Serverless on AWS', detail: 'Lambda, IoT Core, and Location Service handle ingestion and geofencing end to end' },
        { icon: <LockKey className="size-4" />, title: 'Secured with Cognito', detail: 'Every device is scoped to exactly one owner, enforced server-side' },
      ],
    },
    {
      heading: 'Everyday use',
      items: [
        { icon: <DeviceMobile className="size-4" />, title: 'Web and mobile, one account', detail: 'A full web dashboard and a companion app for iOS and Android' },
        { icon: <Motorcycle className="size-4" />, title: 'One owner, one vehicle', detail: 'No teams or shared access, just you and the vehicle you registered' },
      ],
    },
  ];

  return (
    <section className={`py-20 ${SURFACE}`}>
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <p className={`font-mono text-[10px] uppercase tracking-[0.17em] mb-10 ${PRIMARY_TEXT}`}>
          Under the hood
        </p>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
          {groups.map((group) => (
            <div key={group.heading}>
              <p className={`text-sm font-semibold mb-6 ${TEXT}`}>{group.heading}</p>
              <div className="space-y-6">
                {group.items.map((item) => (
                  <FlowItem key={item.title} icon={item.icon} title={item.title} detail={item.detail} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onGetStarted }) {
  return (
    <section className={`py-24 text-center ${CARD} border-t ${BORDER}`}>
      <div className="mx-auto max-w-2xl px-5 sm:px-8 flex flex-col items-center">
        <h2 className={`text-3xl font-semibold tracking-[-0.02em] leading-tight ${TEXT}`}>
          Ready to protect your vehicle?
        </h2>
        <button
          onClick={onGetStarted}
          className={`mt-8 h-11 px-7 rounded-xl ${PRIMARY_BG} text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80`}
        >
          {PRIMARY_CTA}
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={`py-8 text-center ${SURFACE}`}>
      <p className={`text-xs ${MUTED}`}>
        Vsmart Tracking. A graduation project, built on real AWS infrastructure.
      </p>
    </footer>
  );
}

export default function LandingPage({ onGetStarted }) {
  return (
    <div className={`min-h-screen font-sans ${TEXT}`}>
      <DirectionContract />
      <Hero onGetStarted={onGetStarted} />
      <Mechanism />
      <AntiTheft />
      <History />
      <Facts />
      <FinalCta onGetStarted={onGetStarted} />
      <Footer />
    </div>
  );
}
