export enum Environment {
  Local,
  Prod,
}
export class Config {
  public static serverUrl = "https://org457e405f.crm.dynamics.com"; //Trail Local
  public static Environment = Environment.Prod;
  public static tokenUrl =
    "https://prod-101.westus.logic.azure.com:443/workflows/5167449bea3942238c1cc3727050f4a4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=uTlSL2fx7BrA_xlsSyM0iK9nhhsQ_F5FfhWKtLQbe0g";
}
