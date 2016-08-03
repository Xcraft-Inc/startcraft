# StartCraft

> "Jacked up and good to go."

`npm install startcraft --save-dev`

## Use case

- :goberserk: You hate publishing your modules each time you need to use it ?

-  :construction: You have a dev package containing future nodejs modules or git submodules ?

- :goat: npm link don't do the job ?

- :clapper: you have some script to start in your modules ?

*startcraft* can help you :punch:

## What startcraft do for you ?

- :wrench: symlink your dev modules in the root node_modules
- :octopus: npm install your dev modules depencencies in the root node_modules
- :racehorse: run special `"startcraft": "echo hello"` scripts entry of your dev modules
- :cake: can run pre/post startcraft scripts for you

Okey...

## Example

You develop the next killer *space invader* mmo-shooter  :space_invader:,
but you need to hack in your :fire: toolbox modules for adding new features.

You have a non-trivial dev process, you need to launch some scripts with
the front-end (webpack etc.)...

You friend :neckbeard: want contribute ! How to bootstrap the craft ?

- Prepare a dev module (with repository) called: `invaders-dev`

- Add git submodules for your own toolbox, framework, front-end...

- Install startcraft as dev-deps

- Hack in the .scrc file and add your own modules in the list

- Add startcraft in pre and postinstall script of your `invaders-dev` package.json
- Give the `invaders-dev` repo url to your friend, and he can just npm install in it!

## How to use and configure

Add `startcraft` pre/post install entries to your `package.json`:

```json
"scripts": {
  "preinstall": "startcraft",
  "postinstall": "startcraft",
},
```

Touch a json file named `.scrc` in your root package directory:

```json
{
  "npmInstallArgs": [],
  "modules": [
    "./lib/my-first-module",
    "./lib/my-second-module"
  ],
  "scripts": {
    "presc": {
      "postinstall" : [
        "git submodule update --init --recursive",
        "git submodule foreach --recursive git checkout master",
        "git submodule foreach --recursive git pull"
      ]
    },
    "postsc": {}
  }
}
```
`npmInstallArgs` can be used to add custom args for when startcraft perform `npm install`.

`modules` entries is relative paths to your modules from the dev root package.

`scripts` entries is hooked on the npm lifecycle.
You can tell if they run pre or post `startcraft` run.
