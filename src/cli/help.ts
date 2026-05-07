export function printHelp(): void {
  console.info(`
    shufffle — Node Reverse Proxy

    **USAGE**
    
    shufffle [options]


    **OPTIONS**

    -c, --config <path>      Path to config file (default: ./proxy.config.json)
    -l, --log-level <level>  Log level: debug | info | warn | error | silent (default: info)
    -e, --env <key=value>    Set environment variables (can be used multiple times). Variables already present
                             in process.env are also honored. .env files are not loaded automatically — use a
                             loader (e.g. \`node --env-file=.env\`) if you want that behavior.
    -b, --balancer <name>    Load balancer strategy: round-robin | random | weighted (overrides config)
    -h, --help               Show this help message

    **CONFIG FORMAT**

    DEFAULT CONFIG: proxy.config.json

    {
      "port": 8080,
      "balancer": "round-robin",
      "headers": {
        "response": { "X-Powered-By": "shufffle" }
      },
      "routes": [
        {
          "match": "/api",
          "rewrite": { "stripPrefix": "/api" },
          "upstreams": [
            { "host": "localhost", "port": 3001 },
            { "host": "localhost", "port": 3002 }
          ]
        },
        {
          "match": "/",
          "upstreams": [{ "host": "localhost", "port": 3000 }]
        }
      ]
    }

    **EXAMPLES**
    
    shufffle
    shufffle --config ./config/dev.json --log-level debug
`);
}
