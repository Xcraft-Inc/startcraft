# StartCraft

> "Jacked up and good to go."

`npm install --save-dev startcraft`

## Use case

- :goberserk: You hate publishing your modules each time you need to use it?
- :construction: You have a development package containing future nodejs
  modules or `git submodules`?
- :goat: `npm link` doesn't do the job?
- :clapper: You have some scripts to start in your modules?

*startcraft* can help you :punch:

## What startcraft do for you?

- :wrench: symlink your development modules in the root `node_modules/`.
- :octopus: `npm install` your development modules depencencies in the root
  `node_modules/`.
- :racehorse: run special `"startcraft": "echo hello"` scripts entry of your
  development modules.
- :cake: can run pre/post `startcraft` scripts for you.

Okay...

## Example

You develop the next killer *space invader* mmo-shooter :space_invader:,
but you need to hack in your :fire: toolbox modules for adding new features.

You have a non-trivial development process where you need to launch some
scripts with the front-end (webpack etc.)...

You friend :neckbeard: wants to contribute! How to bootstrap the craft?

- Prepare a dev module (with repository) called: `invaders-dev`.
- Add git submodules for your own toolbox, framework, front-end...
- Install startcraft as dev-dep.
- Hack in the `.scrc` file and add your own modules in the list.
- Add `startcraft` in *postinstall* and *postshrinkwrap* scripts of
  your `invaders-dev` `package.json`.
- Give the `invaders-dev` repo url to your friend, and he can just `npm install`
  in it!

## How to use and configure

Add `startcraft` post install and post shrinkwrap entries to your `package.json`:

```json
"scripts": {
  "postinstall": "startcraft",
  "postshrinkwrap": "startcraft"
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
  "exclude": [],
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

`npmInstallArgs` can be used to add custom args when startcraft performs
`npm install`.

`modules` entries is relative paths to your modules from the dev root package.

`exclude` is an array of node modules to not install directly when extracting
the list of dependencies fo each `"modules"`.

`scripts` entries is hooked on the npm lifecycle. You can tell if they run in
pre (`presc`) or post (`postrc`) `startcraft` run.
