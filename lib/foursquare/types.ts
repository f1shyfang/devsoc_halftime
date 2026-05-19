export type FoursquarePlace = {
  fsq_place_id: string;
  name: string;
  location: {
    address?: string;
    formatted_address?: string;
  };
  distance: number;  // metres from the search ll
};

export type FoursquarePhoto = {
  prefix: string;
  suffix: string;
};
