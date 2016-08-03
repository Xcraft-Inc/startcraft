# startcraft

> "Jacked up and good to go."

`npm install startcraft --save-dev`

## Use case

-  :construction: You have a dev package containing future nodejs modules or git submodules ?

- :goat: npm link don't do the job ?

- :clapper: you have some script to start in your modules ?

*startcraft* can help you :punch:

## What startcraft do for you ?

- :wrench: symlink your dev modules in the root node_modules
- :octopus: npm install your dev modules depencencies in the root node_modules
- :racehorse: run special `"startcraft": "echo hello"` scripts entry of your dev modules
- :cake: can run pre/post startcraft scripts for you

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
