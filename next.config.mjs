/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/**": ["./knowledge/**"],
  },
};
export default nextConfig;
