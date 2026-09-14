require "liquid"

template = Liquid::Template.parse(File.read(File.join(__dir__, "_includes/head.html")), error_mode: :strict)
site = { "cf_images_account_hash" => "account", "cf_images_variants" => { "xl" => "large" } }
base = "https://imagedelivery.net/account/"
images = [{ "id" => "first" }, { "id" => "second" }]
legacy = '<meta property="og:image" content="https://example.com/legacy.jpg">'
robots = '<meta name="robots" content="noindex">'

[
  ["explicit cover", { "cover" => "second", "images" => images }, "#{base}second/large"],
  ["cover alone", { "cover" => "chosen" }, "#{base}chosen/large"],
  ["first image", { "images" => images }, "#{base}first/large"],
  ["scalar image", { "images" => ["scalar"] }, "#{base}scalar/large"],
  ["blank cover", { "cover" => "", "images" => images }, "#{base}first/large"],
  ["no images", {}, nil],
  ["empty images", { "images" => [] }, nil],
  ["ignored legacy preview", { "extra_meta" => legacy, "images" => images }, "#{base}first/large"],
  ["cover ignores legacy preview", { "extra_meta" => legacy, "cover" => "chosen" }, "#{base}chosen/large"],
  ["ignored extra metadata", { "extra_meta" => robots, "images" => images }, "#{base}first/large"],
  ["escaping", { "cover" => 'photo"&' }, "#{base}photo&quot;&amp;/large"],
  ["missing account", { "cover" => "chosen" }, nil, { "cf_images_variants" => { "xl" => "large" } }],
  ["missing variant", { "cover" => "chosen" }, nil, { "cf_images_account_hash" => "account" }]
].each do |name, page, expected, config|
  html = template.render!("page" => page, "site" => config || site)
  actual = html.scan(/<meta property="og:image" content="([^"]*)">/).flatten
  raise "#{name}: expected #{expected.inspect}, got #{actual.inspect}" unless actual == Array(expected)
  if page["extra_meta"] && html.include?(page["extra_meta"])
    raise "#{name}: extra_meta was rendered"
  end
end

puts "Cover metadata checks passed."
