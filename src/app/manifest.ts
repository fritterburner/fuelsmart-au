import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FuelSmart AU",
    short_name: "FuelSmart",
    description: "Find the cheapest fuel prices across Australia — live map, trends, and trip planning.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EEF8F4",
    theme_color: "#0FB39A",
    orientation: "portrait",
    categories: ["travel", "navigation", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
