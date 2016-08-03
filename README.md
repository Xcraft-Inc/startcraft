# startcraft

> "Jacked up and good to go."

## Configuration

Simply put a json file named `.scrc`.

The content must have the relative paths on the modules to ignore with the calls on
`npm install`.

```json
{
  "npmargs": [],
  "modules": [
    "./lib/my-first-module",
    "./lib/my-second-module"
  ]
}
```
