workflow "Publish Gem" {
  on = "push"
  resolves = ["Release Gem"]
}

action "Tag Filter" {
  uses = "actions/bin/filter@master"
  args = "tag v*"
}

action "Release Gem" {
  uses = "cadwallion/publish-rubygems-action@master"
  secrets = ["GITHUB_TOKEN", "RUBYGEMS_API_KEY"]
  env = {
    RELEASE_COMMAND = "./release.sh"
  }
}
