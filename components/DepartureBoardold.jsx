export default function DepartureBoard({ arrivals }) {
  const sorted = arrivals.sort((a, b) => a.timeToStation - b.timeToStation);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Upcoming Departures</h2>
      <table className="w-full bg-white rounded shadow overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 text-left">Line</th>
            <th className="p-2 text-left">Destination</th>
            <th className="p-2 text-left">Platform</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Expected</th>
            <th className="p-2 text-left">Countdown</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((train) => (
            <tr key={train.id} className="border-t">
              <td className="p-2">{train.lineName}</td>
              <td className="p-2">{train.destinationName}</td>
              <td className="p-2">{train.platformName || "-"}</td>
              <td className="p-2">{train.currentLocation || "-"}</td>
              <td className="p-2">
                {new Date(train.expectedArrival).toLocaleTimeString()}
              </td>
              <td className="p-2">
                {(train.timeToStation / 60).toFixed(0)} min
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
