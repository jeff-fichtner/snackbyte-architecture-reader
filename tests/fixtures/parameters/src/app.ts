export type Deps = {
  resolve(host: string): string;
  engine(tenant: string): string;
  mount: { log(message: string): void };
};

export function createApp(deps: Deps): (path: string) => void {
  routes(deps);
  return (path) => {
    const tenant = deps.resolve(path);
    deps.engine(tenant);
  };
}

function routes(deps: Deps): void {
  deps.mount.log('mounted');
}
