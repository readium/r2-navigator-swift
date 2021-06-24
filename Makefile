help:
	@echo "Usage: make <target>\n\n\
	  scripts\tBundle EPUB scripts with Webpack\n\
	"

scripts:
	yarn --cwd "r2-navigator-swift/EPUB/Scripts" run format
	cd r2-navigator-swift/EPUB/Scripts && npx webpack
