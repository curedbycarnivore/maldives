import { Context, Effect, Layer, Schema, pipe } from "effect";

function serviceComponent(): ClassDecorator {
  return () => undefined;
}

function route(_: unknown, _context: ClassMethodDecoratorContext): void {
  return undefined;
}

const UserId = Schema.String;
const OrgId = Schema.String;
const Timestamp = Schema.Number;

const User = Schema.Struct({
  id: UserId,
  orgId: OrgId,
  name: Schema.String,
  email: Schema.String,
  active: Schema.Boolean,
  revision: Schema.Number,
});
type User = typeof User.Type;

const Project = Schema.Struct({
  id: Schema.String,
  orgId: OrgId,
  ownerId: UserId,
  name: Schema.String,
  archived: Schema.Boolean,
});
type Project = typeof Project.Type;

const AuditEvent = Schema.Struct({
  id: Schema.String,
  actorId: UserId,
  target: Schema.String,
  action: Schema.String,
  at: Timestamp,
});
type AuditEvent = typeof AuditEvent.Type;

const DashboardCard = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  value: Schema.Number,
  trend: Schema.String,
});
type DashboardCard = typeof DashboardCard.Type;

interface EntityRecord {
  readonly id: string;
  readonly orgId: string;
}

interface RepositoryMetrics {
  readonly reads: number;
  readonly writes: number;
}

@serviceComponent()
class Repository<T extends EntityRecord> {
  readonly metrics: RepositoryMetrics = { reads: 0, writes: 0 };

  constructor(
    readonly label: string,
    readonly rows: ReadonlyArray<T>,
  ) {}

  findById<A extends T>(id: string): Effect.Effect<A, Error, AuditLog> {
    return pipe(
      Effect.succeed(this.rows.find((row): row is A => row.id === id)),
      Effect.flatMap((row) => (row ? Effect.succeed(row) : Effect.fail(new Error(`${this.label}:${id}`)))),
    );
  }

  listByOrg(orgId: string): Effect.Effect<ReadonlyArray<T>, never, never> {
    return Effect.succeed(this.rows.filter((row) => row.orgId === orgId));
  }

  save(next: T): Effect.Effect<T, never, AuditLog> {
    return Effect.gen(function* () {
      const audit = yield* AuditLog;
      yield* audit.write({ id: `audit-${next.id}`, actorId: next.id, target: this.label, action: "save", at: Date.now() });
      return next;
    }.bind(this));
  }
}

class AuditLog extends Context.Tag("AuditLog")<AuditLog, {
  readonly write: (event: AuditEvent) => Effect.Effect<void>;
  readonly flush: () => Effect.Effect<ReadonlyArray<AuditEvent>>;
}>() {}

class UserRepo extends Context.Tag("UserRepo")<UserRepo, Repository<User>>() {}
class ProjectRepo extends Context.Tag("ProjectRepo")<ProjectRepo, Repository<Project>>() {}
class ClockService extends Context.Tag("ClockService")<ClockService, { readonly now: () => Effect.Effect<number> }>() {}
class NotificationService extends Context.Tag("NotificationService")<NotificationService, {
  readonly notify: (user: User, message: string) => Effect.Effect<void>;
}>() {}

const seedUsers: ReadonlyArray<User> = [
  { id: "u-1", orgId: "org-1", name: "Ada", email: "ada@example.test", active: true, revision: 1 },
  { id: "u-2", orgId: "org-1", name: "Grace", email: "grace@example.test", active: true, revision: 2 },
  { id: "u-3", orgId: "org-2", name: "Mary", email: "mary@example.test", active: false, revision: 3 },
];

const seedProjects: ReadonlyArray<Project> = [
  { id: "p-1", orgId: "org-1", ownerId: "u-1", name: "Compiler", archived: false },
  { id: "p-2", orgId: "org-1", ownerId: "u-2", name: "Observability", archived: false },
  { id: "p-3", orgId: "org-2", ownerId: "u-3", name: "Archive", archived: true },
];

const AuditLive = Layer.succeed(AuditLog, {
  write: (event) => Effect.sync(() => console.info("audit", event.action, event.target)),
  flush: () => Effect.succeed([]),
});

const ClockLive = Layer.succeed(ClockService, {
  now: () => Effect.succeed(Date.now()),
});

const NotificationLive = Layer.succeed(NotificationService, {
  notify: (user, message) => Effect.sync(() => console.info("notify", user.email, message)),
});

const UserRepoLive = Layer.succeed(UserRepo, new Repository<User>("users", seedUsers));
const ProjectRepoLive = Layer.succeed(ProjectRepo, new Repository<Project>("projects", seedProjects));

export const AppLayer = Layer.mergeAll(
  AuditLive,
  ClockLive,
  NotificationLive,
  UserRepoLive,
  ProjectRepoLive,
);

interface DashboardSection<A> {
  readonly title: string;
  readonly load: Effect.Effect<A, Error, UserRepo | ProjectRepo | AuditLog | ClockService>;
}

const activeUsersSection: DashboardSection<ReadonlyArray<User>> = {
  title: "Active users",
  load: Effect.gen(function* () {
    const repo = yield* UserRepo;
    const users = yield* repo.listByOrg("org-1");
    return users.filter((user) => user.active);
  }),
};

const projectsSection: DashboardSection<ReadonlyArray<Project>> = {
  title: "Projects",
  load: Effect.gen(function* () {
    const repo = yield* ProjectRepo;
    return yield* repo.listByOrg("org-1");
  }),
};

const auditSection: DashboardSection<ReadonlyArray<AuditEvent>> = {
  title: "Audit",
  load: Effect.gen(function* () {
    const audit = yield* AuditLog;
    return yield* audit.flush();
  }),
};

@serviceComponent()
class EffectStressDashboard<TUser extends User> {
  constructor(readonly orgId: string) {}

  @route
  loadUser(id: string): Effect.Effect<TUser, Error, UserRepo | AuditLog> {
    return Effect.gen(function* () {
      const repo = yield* UserRepo;
      const user = yield* repo.findById<TUser>(id);
      const audit = yield* AuditLog;
      yield* audit.write({ id: `audit-${id}`, actorId: id, target: "user", action: "load", at: Date.now() });
      return user;
    });
  }

  @route
  loadDashboard(): Effect.Effect<ReadonlyArray<DashboardCard>, Error, UserRepo | ProjectRepo | AuditLog | ClockService> {
    return Effect.gen(function* () {
      const users = yield* activeUsersSection.load;
      const projects = yield* projectsSection.load;
      const audit = yield* auditSection.load;
      const clock = yield* ClockService;
      const now = yield* clock.now();
      return [
        { id: "users", title: "Users", value: users.length, trend: `${now}` },
        { id: "projects", title: "Projects", value: projects.length, trend: "steady" },
        { id: "audit", title: "Audit", value: audit.length, trend: "quiet" },
      ];
    });
  }

  @route
  saveAndNotify(user: TUser): Effect.Effect<TUser, never, UserRepo | AuditLog | NotificationService> {
    return Effect.gen(function* () {
      const repo = yield* UserRepo;
      const notifications = yield* NotificationService;
      const saved = yield* repo.save(user);
      yield* notifications.notify(saved, "Profile saved");
      return saved;
    });
  }
}

const dashboard = new EffectStressDashboard<User>("org-1");

export const loadDashboardProgram = pipe(
  dashboard.loadDashboard(),
  Effect.provide(AppLayer),
);

export const saveUserProgram = pipe(
  dashboard.saveAndNotify({ id: "u-4", orgId: "org-1", name: "Katherine", email: "kat@example.test", active: true, revision: 1 }),
  Effect.provide(AppLayer),
);

export const routeDefinitions = [
  { method: "GET", path: "/users/:id", action: dashboard.loadUser("u-1") },
  { method: "GET", path: "/dashboard", action: dashboard.loadDashboard() },
  { method: "POST", path: "/users", action: saveUserProgram },
] as const;

export const warmCacheProgram = Effect.gen(function* () {
  const repo = yield* UserRepo;
  Effect.succeed("floating warmup");
  const users = yield* repo.listByOrg("org-1");
  return users.map((user) => user.email);
});

export const missingStarProgram = Effect.gen(function* () {
  const label = yield Effect.succeed("dashboard");
  return label;
});

export const missingAuditContextProgram: Effect.Effect<string, never, never> = Effect.gen(function* () {
  const audit = yield* AuditLog;
  yield* audit.write({ id: "audit-missing", actorId: "u-1", target: "stress", action: "missing-context", at: Date.now() });
  return "missing context";
});

export const missingErrorButPromisesNever: Effect.Effect<string, never, never> = Effect.fail(new Error("stress failure"));

export const missingLayerContext: Layer.Layer<UserRepo, never, never> = Layer.effect(
  UserRepo,
  Effect.gen(function* () {
    const audit = yield* AuditLog;
    yield* audit.write({ id: "audit-layer", actorId: "u-2", target: "layer", action: "construct", at: Date.now() });
    return new Repository<User>("users", seedUsers);
  }),
);

type ApiResponse<A> = {
  readonly status: number;
  readonly body: A;
  readonly headers: Readonly<Record<string, string>>;
};

function ok<A>(body: A): ApiResponse<A> {
  return { status: 200, body, headers: { "content-type": "application/json" } };
}

function renderCard(card: DashboardCard): string {
  return `${card.title}: ${card.value} (${card.trend})`;
}

export function DashboardPreview(): JSX.Element {
  const cards: ReadonlyArray<DashboardCard> = [
    { id: "users", title: "Users", value: 2, trend: "up" },
    { id: "projects", title: "Projects", value: 2, trend: "steady" },
  ];
  return <section data-org="org-1">{cards.map((card) => <article key={card.id}>{renderCard(card)}</article>)}</section>;
}

const healthCheck = Effect.gen(function* () {
  const clock = yield* ClockService;
  const now = yield* clock.now();
  return ok({ service: "maldives", now });
});

export const healthRoute = pipe(
  healthCheck,
  Effect.provide(ClockLive),
);

const notificationDigest = Effect.gen(function* () {
  const repo = yield* UserRepo;
  const users = yield* repo.listByOrg("org-1");
  return users.map((user) => ({ user, message: `${user.name} has ${user.revision} revisions` }));
});

export const notificationDigestProgram = pipe(
  notificationDigest,
  Effect.provide(UserRepoLive),
);

export const dashboardSections = [
  activeUsersSection,
  projectsSection,
  auditSection,
] as const;

export const cardPipeline = (cards: ReadonlyArray<DashboardCard>) => pipe(
  cards,
  (items) => items.filter((card) => card.value >= 0),
  (items) => items.map((card) => ({ ...card, title: card.title.toUpperCase() })),
);

export const projectOwnerEmails = Effect.gen(function* () {
  const users = yield* activeUsersSection.load;
  const projects = yield* projectsSection.load;
  return projects.map((project) => ({
    project: project.name,
    owner: users.find((user) => user.id === project.ownerId)?.email ?? "unknown",
  }));
});

export const composedDashboard = pipe(
  projectOwnerEmails,
  Effect.provide(AppLayer),
);

const dailyJobs = [
  Effect.succeed("refresh-search-index"),
  Effect.succeed("compact-audit-log"),
  Effect.succeed("email-digest"),
];

export const runDailyJobs = Effect.gen(function* () {
  const audit = yield* AuditLog;
  for (const job of dailyJobs) {
    const name = yield* job;
    yield* audit.write({ id: `job-${name}`, actorId: "system", target: name, action: "run", at: Date.now() });
  }
  return "complete" as const;
});

export const runDailyJobsLive = pipe(
  runDailyJobs,
  Effect.provide(AuditLive),
);

const settingsSchema = Schema.Struct({
  theme: Schema.String,
  autosave: Schema.Boolean,
  maxOpenFiles: Schema.Number,
});

type Settings = typeof settingsSchema.Type;

const defaultSettings: Settings = {
  theme: "tomorrow-night-eighties",
  autosave: false,
  maxOpenFiles: 12,
};

export const loadSettings = Effect.succeed(defaultSettings);

export const settingsRoute = pipe(
  loadSettings,
  Effect.map(ok),
);

const telemetryEvents = [
  "editor.open",
  "editor.save",
  "diagnostics.refresh",
  "workspace.switch",
  "keymap.execute",
  "theme.apply",
];

export const telemetryProgram = Effect.gen(function* () {
  const audit = yield* AuditLog;
  for (const event of telemetryEvents) {
    yield* audit.write({ id: `telemetry-${event}`, actorId: "system", target: "telemetry", action: event, at: Date.now() });
  }
  return telemetryEvents.length;
});

export const telemetryProgramLive = pipe(
  telemetryProgram,
  Effect.provide(AuditLive),
);

export const stressFileSummary = {
  purpose: "P30e large real-user Effect workload",
  lines: "300-500",
  services: ["AuditLog", "UserRepo", "ProjectRepo", "ClockService", "NotificationService"],
  programs: [loadDashboardProgram, saveUserProgram, runDailyJobsLive, telemetryProgramLive],
};
