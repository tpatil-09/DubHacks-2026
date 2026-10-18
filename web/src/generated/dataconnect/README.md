# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `vetted`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListSyntheticDemoProfiles*](#listsyntheticdemoprofiles)
- [**Mutations**](#mutations)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `vetted`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@vetted/dataconnect-generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@vetted/dataconnect-generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@vetted/dataconnect-generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `vetted` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListSyntheticDemoProfiles
You can execute the `ListSyntheticDemoProfiles` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listSyntheticDemoProfiles(options?: ExecuteQueryOptions): QueryPromise<ListSyntheticDemoProfilesData, undefined>;

interface ListSyntheticDemoProfilesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSyntheticDemoProfilesData, undefined>;
}
export const listSyntheticDemoProfilesRef: ListSyntheticDemoProfilesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSyntheticDemoProfiles(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSyntheticDemoProfilesData, undefined>;

interface ListSyntheticDemoProfilesRef {
  ...
  (dc: DataConnect): QueryRef<ListSyntheticDemoProfilesData, undefined>;
}
export const listSyntheticDemoProfilesRef: ListSyntheticDemoProfilesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSyntheticDemoProfilesRef:
```typescript
const name = listSyntheticDemoProfilesRef.operationName;
console.log(name);
```

### Variables
The `ListSyntheticDemoProfiles` query has no variables.
### Return Type
Recall that executing the `ListSyntheticDemoProfiles` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSyntheticDemoProfilesData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListSyntheticDemoProfiles`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSyntheticDemoProfiles } from '@vetted/dataconnect-generated';


// Call the `listSyntheticDemoProfiles()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSyntheticDemoProfiles();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSyntheticDemoProfiles(dataConnect);

console.log(data.demoProfiles);

// Or, you can use the `Promise` API.
listSyntheticDemoProfiles().then((response) => {
  const data = response.data;
  console.log(data.demoProfiles);
});
```

### Using `ListSyntheticDemoProfiles`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSyntheticDemoProfilesRef } from '@vetted/dataconnect-generated';


// Call the `listSyntheticDemoProfilesRef()` function to get a reference to the query.
const ref = listSyntheticDemoProfilesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSyntheticDemoProfilesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.demoProfiles);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.demoProfiles);
});
```

# Mutations

No mutations were generated for the `vetted` connector.

If you want to learn more about how to use mutations in Data Connect, you can follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

