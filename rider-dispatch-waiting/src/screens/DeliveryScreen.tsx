import { DispatchMap } from "../components/DispatchMap";
import { DeliveryChrome } from "../components/DeliveryChrome";

export function DeliveryScreen() {
  const markers = [
    { lat: 37.6584, lng: 126.7681 },
    { lat: 37.662, lng: 126.76 },
    { lat: 37.67, lng: 126.75 },
  ];

  const path = [
    { lat: 37.6584, lng: 126.7681 },
    { lat: 37.662, lng: 126.76 },
    { lat: 37.67, lng: 126.75 },
  ];

  return (
    <div className="relative h-screen w-full">
      <DispatchMap
      mode="delivery"
      markers={[
        { lat: 37.6584, lng: 126.7681 },
        { lat: 37.662, lng: 126.76 },
        { lat: 37.67, lng: 126.75 },
      ]}
      path={[
        { lat: 37.6584, lng: 126.7681 },
        { lat: 37.662, lng: 126.76 },
        { lat: 37.67, lng: 126.75 },
      ]}
    />
      <DeliveryChrome />
    </div>
  );
}