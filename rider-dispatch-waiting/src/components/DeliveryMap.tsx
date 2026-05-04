import { useEffect } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

export function DeliveryMap() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "//dapi.kakao.com/v2/maps/sdk.js?appkey=bcf7eb5c746613f012fdf704d51e6b38&autoload=false";
    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        const container = document.getElementById("map");
        if (!container) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(37.665, 126.76),
          level: 5,
        });

        const pickup = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(37.6584, 126.7681),
        });

        const dropoff = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(37.67, 126.75),
        });

        pickup.setMap(map);
        dropoff.setMap(map);

        const linePath = [
          new window.kakao.maps.LatLng(37.6584, 126.7681),
          new window.kakao.maps.LatLng(37.662, 126.76),
          new window.kakao.maps.LatLng(37.67, 126.75),
        ];

        const polyline = new window.kakao.maps.Polyline({
          path: linePath,
          strokeWeight: 5,
          strokeColor: "#FF0000",
        });

        polyline.setMap(map);
      });
    };
  }, []);

  return <div id="map" style={{ width: "100%", height: "100%" }} />;
}