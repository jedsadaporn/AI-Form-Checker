const nextConfig = {
  webpack: (config: any, { isServer }: any) => {
    if (!isServer) {
      config.externals = [
        ...(config.externals || []),
        { "@mediapipe/pose": "globalThis" },
      ];
    }
    return config;
  },
};

export default nextConfig;
