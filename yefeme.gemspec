# coding: utf-8

Gem::Specification.new do |spec|
  spec.name          = "yefeme"
  spec.version       = "0.7.1"
  spec.authors       = ["Yefim Vedernikoff"]
  spec.email         = ["yefim323@gmail.com"]

  spec.summary       = "Yefim's custom jekyll theme"
  spec.homepage      = "https://github.com/yefim/yefeme"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0").select { |f| f.match(%r{^(assets|_layouts|_includes|_sass|LICENSE|README|index|config)}i) }

  spec.add_runtime_dependency "jekyll", "~> 4.1"
end
