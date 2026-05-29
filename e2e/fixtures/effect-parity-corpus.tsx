import { Context, Effect, Layer, Schema, pipe } from "effect";

function sealed(): ClassDecorator {
  return () => undefined;
}

@sealed()
class Repository<T extends { id: string }> {
  constructor(readonly rows: ReadonlyArray<T>) {}

  find<A extends T>(id: string): Effect.Effect<A, Error, AuditLog> {
    return pipe(
      Effect.succeed(this.rows.find((row): row is A => row.id === id)),
      Effect.flatMap((row) => (row ? Effect.succeed(row) : Effect.fail(new Error(id)))),
    );
  }
}

const User = Schema.Struct({ id: Schema.String, name: Schema.String });
type User = typeof User.Type;

class AuditLog extends Context.Tag("AuditLog")<AuditLog, { readonly write: (event: string) => Effect.Effect<void> }>() {}
class UserRepo extends Context.Tag("UserRepo")<UserRepo, Repository<User>>() {}

const UserRepoLive = Layer.effect(
  UserRepo,
  Effect.succeed(new Repository<User>([{ id: "1", name: "Ada" }])),
);

const AuditLive = Layer.succeed(AuditLog, {
  write: (event) => Effect.sync(() => console.info(event)),
});

export const AppLayer = Layer.merge(UserRepoLive, AuditLive);

export const floatingProgram = Effect.gen(function* () {
  Effect.succeed("floating");
  return yield* Effect.succeed(UserRepoLive);
});

export const missingStarProgram = Effect.gen(function* () {
  const name = yield Effect.succeed("Ada");
  return name;
});

export const needsAuditButPromisesNone: Effect.Effect<string, never, never> = Effect.gen(function* () {
  const audit = yield* AuditLog;
  yield* audit.write("loaded");
  return "done";
});

export const findUserWithoutAudit: Effect.Effect<User, Error, never> = Effect.gen(function* () {
  const repo = yield* UserRepo;
  return yield* repo.find("1");
});

export const missingErrorButPromisesNever: Effect.Effect<string, never, never> = Effect.fail(new Error("boom"));
