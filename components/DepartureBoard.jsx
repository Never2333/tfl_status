export default function DepartureBoard({ arrivals, lineStatuses }) {
  // 按站台分组
  const groupedByPlatform = arrivals.reduce((groups, train) => {
    const platform = train.platformName || "Unknown";
    if (!groups[platform]) {
      groups[platform] = [];
    }
    groups[platform].push(train);
    return groups;
  }, {});

  // 按时间排序每个站台的列车
  Object.keys(groupedByPlatform).forEach(platform => {
    groupedByPlatform[platform] = groupedByPlatform[platform].sort((a, b) => a.timeToStation - b.timeToStation);
  });

  // 获取线路状态
  const getLineStatus = (lineName) => {
    const status = lineStatuses.find(ls => ls.name === lineName);
    return status ? status.statusSeverityDescription : "Unknown";
  };

  // 获取线路颜色类
  const getLineColor = (lineName) => {
    const lineColors = {
      "Bakerloo": "bg-amber-600",
      "Central": "bg-red-600",
      "Circle": "bg-yellow-500",
      "District": "bg-green-600", 
      "Hammersmith & City": "bg-pink-500",
      "Jubilee": "bg-gray-400",
      "Metropolitan": "bg-purple-600",
      "Northern": "bg-black",
      "Piccadilly": "bg-blue-800",
      "Victoria": "bg-blue-500",
      "Waterloo & City": "bg-teal-500"
    };
    return lineColors[lineName] || "bg-gray-600";
  };

  return (
    <div className="bg-black text-white p-6 rounded-lg shadow-2xl font-mono">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">LONDON UNDERGROUND</h1>
        <div className="text-lg text-gray-300">Live Departures</div>
      </div>

      {Object.keys(groupedByPlatform).map(platform => (
        <div key={platform} className="mb-8">
          <div className="flex items-center mb-3">
            <div className="bg-white text-black px-3 py-1 rounded font-bold mr-3">
              Platform {platform}
            </div>
            <div className="h-1 bg-yellow-400 flex-1"></div>
          </div>
          
          <div className="space-y-2">
            {groupedByPlatform[platform].slice(0, 6).map((train) => (
              <div key={train.id} className="bg-gray-900 p-4 rounded-lg border-l-4 border-yellow-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`${getLineColor(train.lineName)} text-white px-3 py-1 rounded font-bold min-w-20 text-center`}>
                      {train.lineName}
                    </div>
                    <div className="text-xl font-semibold">
                      {train.destinationName}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-400">
                      {train.timeToStation < 60 ? "Due" : `${Math.round(train.timeToStation / 60)} min`}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(train.expectedArrival).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
                
                {train.currentLocation && (
                  <div className="mt-2 text-sm text-gray-300">
                    Currently at: {train.currentLocation}
                  </div>
                )}
                
                <div className="mt-2 text-sm">
                  <span className={`px-2 py-1 rounded ${
                    getLineStatus(train.lineName).toLowerCase().includes("good") 
                      ? "bg-green-600" 
                      : getLineStatus(train.lineName).toLowerCase().includes("minor") 
                      ? "bg-yellow-600"
                      : "bg-red-600"
                  }`}>
                    {getLineStatus(train.lineName)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {arrivals.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No departures found for this station
        </div>
      )}
      
      <div className="text-center mt-6 text-gray-500 text-sm">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}