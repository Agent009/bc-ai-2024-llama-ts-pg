/**
 * @see https://dykraf.com/blog/deploying-nextjs-web-application-with-pm2
 */

const appName = "llama-ts-playground";
const argEnvIndex = process.argv.indexOf("--env");
let argEnv = (argEnvIndex !== -1 && process.argv[argEnvIndex + 1]) || "";

const RUN_ENV_MAP = {
  local: {
    name: appName + "-local",
    instances: 1,
    max_memory_restart: "250M",
    args: "dev -p 3091",
  },
  dev: {
    name: appName + "-dev",
    instances: 1,
    max_memory_restart: "250M",
    args: "dev -p 3091",
  },
  prod: {
    name: appName + "-prod",
    instances: 1,
    max_memory_restart: "1000M",
    args: "start -p 3091",
  },
};

if (!(argEnv in RUN_ENV_MAP)) {
  argEnv = "local";
}

module.exports = {
  apps: [
    {
      name: RUN_ENV_MAP[argEnv].name,
      namespace: "cx.train.ai",
      script: "node_modules/next/dist/bin/next",
      args: RUN_ENV_MAP[argEnv].args,
      instances: RUN_ENV_MAP[argEnv].instances,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: RUN_ENV_MAP[argEnv].max_memory_restart,
      time: true,
      env_local: {
        NEXT_PUBLIC_APP_ENV: "local",
        watch: true,
      },
      env_dev: {
        NEXT_PUBLIC_APP_ENV: "dev",
        watch: true,
      },
      env_prod: {
        NEXT_PUBLIC_APP_ENV: "prod",
      },
    },
  ],
};
