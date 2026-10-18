import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface DemoLike_Key {
  id: UUIDString;
  __typename?: 'DemoLike_Key';
}

export interface DemoProfile_Key {
  uid: string;
  __typename?: 'DemoProfile_Key';
}

export interface DemoReport_Key {
  reportId: string;
  __typename?: 'DemoReport_Key';
}

export interface ListSyntheticDemoProfilesData {
  demoProfiles: ({
    uid: string;
    displayName: string;
    age: number;
    gender: string;
    city: string;
    bio: string;
    interests: string[];
    photos: string[];
    demoLike_on_person?: {
      likes: boolean;
    };
  } & DemoProfile_Key)[];
}

interface ListSyntheticDemoProfilesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSyntheticDemoProfilesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSyntheticDemoProfilesData, undefined>;
  operationName: string;
}
export const listSyntheticDemoProfilesRef: ListSyntheticDemoProfilesRef;

export function listSyntheticDemoProfiles(options?: ExecuteQueryOptions): QueryPromise<ListSyntheticDemoProfilesData, undefined>;
export function listSyntheticDemoProfiles(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSyntheticDemoProfilesData, undefined>;

