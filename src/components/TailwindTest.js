import React from 'react';

const TailwindTest = () => {
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md flex items-center space-x-4">
      <div className="flex-shrink-0">
        <img className="h-12 w-12" src="/logo192.png" alt="React Logo" />
      </div>
      <div>
        <div className="text-xl font-medium text-unimart-pink">Tailwind CSS Test</div>
        <p className="text-gray-500">Tailwind CSS has been successfully integrated!</p>
      </div>
    </div>
  );
};

export default TailwindTest;