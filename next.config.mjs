import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // Plugin names as strings so the options stay serializable for Turbopack.
    remarkPlugins: [["remark-gfm"]],
    rehypePlugins: [],
  },
});

/**
 * Static export for GitHub Pages. BASE_PATH is set by the deploy workflow
 * when serving from a project page (e.g. /botacourse); leave it unset for
 * local dev or a custom domain.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig = {
  output: "export",
  basePath,
  // Plain asset URLs (e.g. the lesson PDF object tag) don't get basePath
  // prefixed automatically the way next/image and Link do; expose it.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  trailingSlash: true,
  turbopack: {},
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  images: {
    unoptimized: true,
  },
  // Lets verification builds target a separate dir so they don't clobber a
  // running dev server (same convention as bota-toolbox).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Allow viewing the dev server from other devices on the LAN (dev-only;
  // without this, Next blocks its scripts cross-origin and the page never
  // hydrates, so nothing interactive works). Same convention as
  // bota-toolbox.
  allowedDevOrigins: ["192.168.1.*", "localhost", "127.0.0.1"],
};

export default withMDX(nextConfig);
