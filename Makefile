help:
	@echo "Usage: make <target>\n\n\
	  scripts\tBundle EPUB scripts with Webpack\n\
	"

scripts:
	cd r2-navigator-swift/EPUB/Scripts && npx webpack
