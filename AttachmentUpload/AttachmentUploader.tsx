import * as React from "react";
import { IInputs } from "./generated/ManifestTypes";
import { useDropzone } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Config, Environment } from "../config";

export interface UploadProps {
  id: string;
  entityName: string;
  entitySetName: string;
  controlToRefresh: string | null;
  uploadIcon: string;
  useNoteAttachment: boolean;
  context: ComponentFramework.Context<IInputs> | undefined;
}

export interface FileInfo {
  name: string;
  type: string;
  body: string;
}

export const AttachmentUploader: React.FC<UploadProps> = (
  uploadProps: UploadProps,
) => {
  const [uploadIcn, setuploadIcn] = React.useState(uploadProps.uploadIcon);
  const [totalFileCount, setTotalFileCount] = React.useState(0);
  const [currentUploadCount, setCurrentUploadCount] = React.useState(0);
  const translate = (name: string) =>
    uploadProps.context?.resources.getString(name);

  const onDrop = React.useCallback(
    (acceptedFiles: any) => {
      if (acceptedFiles && acceptedFiles.length) {
        setTotalFileCount(acceptedFiles.length);
      }

      const toBase64 = async (file: any) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onabort = () => reject();
          reader.onerror = (error) => reject(error);
        });

      const uploadFileToRecord = async (
        id: string,
        entity: string,
        entitySetName: string,
        fileInfo: FileInfo,
        context: ComponentFramework.Context<IInputs>,
      ) => {
        let isActivityMimeAttachment =
          !uploadProps.useNoteAttachment &&
          (entity.toLowerCase() === "email" ||
            entity.toLowerCase() === "appointment");
        let attachmentRecord: ComponentFramework.WebApi.Entity = {};
        if (isActivityMimeAttachment) {
          attachmentRecord["objectid_activitypointer@odata.bind"] =
            `/activitypointers(${id})`;
          attachmentRecord["body"] = fileInfo.body;
        } else {
          attachmentRecord[`objectid_${entity}@odata.bind`] =
            `/${entitySetName}(${id})`;
          attachmentRecord["documentbody"] = fileInfo.body;
        }

        if (fileInfo.type && fileInfo.type !== "") {
          attachmentRecord["mimetype"] = fileInfo.type;
        }

        attachmentRecord["filename"] = fileInfo.name;
        attachmentRecord["objecttypecode"] = entity;
        let attachmentEntity = isActivityMimeAttachment
          ? "activitymimeattachment"
          : "annotation";
        await context.webAPI.createRecord(attachmentEntity, attachmentRecord);
      };
      const uploadFileToSharepoint = async (baseUrl: string, data: any) => {
        if (Config.Environment == Environment.Local) {
          const delay = (millis: any) =>
            new Promise<void>((resolve, reject) => {
              setTimeout((_) => resolve(), millis);
            });
          await delay(1000);
          return true;
        }

        const rawResponse = await fetch(
          baseUrl + "/api/data/v9.0/UploadDocument",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          },
        );
        const statusCode = rawResponse.status;
        console.log(`Status Code: ${statusCode}`);
        return statusCode === 200 || statusCode === 204;
      };

      const uploadFilesToCRM = async (files: any) => {
        let xrmObj: any = (window as any)["Xrm"];
        var globalContext = xrmObj?.Utility?.getGlobalContext();
        let baseUrl = globalContext?.getClientUrl();

        try {
          for (let i = 0; i < acceptedFiles.length; i++) {
            setCurrentUploadCount(i);
            let file = acceptedFiles[i] as any;
            let base64Data = await toBase64(acceptedFiles[i]);
            let base64DataStr = base64Data as string;
            let base64IndexOfBase64 =
              base64DataStr.indexOf(";base64,") + ";base64,".length;
            var base64 = base64DataStr.substring(base64IndexOfBase64);
            let fileInfo: FileInfo = {
              name: file.name,
              type: file.type,
              body: base64,
            };
            let entityId = uploadProps.id;
            let entityName = uploadProps.entityName;
            let dataToSharepoint = {
              Content: base64,
              Entity: {
                "@odata.type": "Microsoft.Dynamics.CRM.sharepointdocument",
                locationid: "",
                title: file.name,
              },
              OverwriteExisting: true,
              ParentEntityReference: {
                "@odata.type": "Microsoft.Dynamics.CRM." + entityName,
                accountid: entityId,
              },
              FolderPath: "",
            };
            if (xrmObj && xrmObj.Page) {
              var filterXml = xrmObj.Page.getControl(
                uploadProps.controlToRefresh,
              );
              let folderPath = "";
              if (filterXml) {
                var parser, xmlDoc;
                parser = new DOMParser();
                xmlDoc = parser.parseFromString(filterXml, "text/xml");
                var htmlColl = xmlDoc.getElementsByTagName("condition");
                var arr: Element[] = Array.from(htmlColl);
                var anyElement = arr
                  .find(
                    (it) => it.getAttribute("attribute") == "relativelocation",
                  )
                  ?.getAttribute("value");
                if (anyElement) folderPath = anyElement;
              }
              dataToSharepoint.FolderPath = folderPath;
            }
            if (entityId == null || entityId === "") {
              //this happens when the record is created and the user tries to upload
              let currentPageContext = uploadProps.context as any;
              currentPageContext = currentPageContext
                ? currentPageContext["page"]
                : undefined;
              entityId = currentPageContext.entityId;
              entityName = currentPageContext.entityTypeName;
              dataToSharepoint.ParentEntityReference["@odata.type"] =
                "Microsoft.Dynamics.CRM" + entityName;
              dataToSharepoint.ParentEntityReference["accountid"] = entityId;
            }
            console.log("data", dataToSharepoint);

            await uploadFileToSharepoint(baseUrl, dataToSharepoint);
            //await uploadFileToRecord(entityId, entityName, uploadProps.entitySetName, fileInfo, uploadProps.context!!);
          }
        } catch (e: any) {
          let errorMessagePrefix =
            acceptedFiles.length === 1
              ? translate("error_while_uploading_attachment")
              : translate("error_while_uploading_attachments");
          let errOptions = { message: `${errorMessagePrefix} ${e.message}` };
          uploadProps.context?.navigation.openErrorDialog(errOptions);
        }

        setTotalFileCount(0);
        if (xrmObj && xrmObj.Page && uploadProps.controlToRefresh) {
          var controlToRefresh = xrmObj.Page.getControl(
            uploadProps.controlToRefresh,
          );
          if (controlToRefresh) {
            controlToRefresh.refresh();
          }
        }
      };

      console.log("acceptedFiles", acceptedFiles);

      uploadFilesToCRM(acceptedFiles);
    },
    [totalFileCount, currentUploadCount],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  if (uploadProps.id == null || uploadProps.id === "") {
    return (
      <div className={"defaultContentCont"}>
        {translate("save_record_to_enable_content")}
      </div>
    );
  }

  let fileStats = null;
  if (totalFileCount > 0) {
    fileStats = (
      <div className={"filesStatsCont uploadDivs"}>
        <div>
          <FontAwesomeIcon
            icon={faSpinner as IconProp}
            inverse
            size="2x"
            spin
          />
        </div>
        <div className={"uploadStatusText"}>
          {translate("uploading")} ({currentUploadCount}/{totalFileCount})
        </div>
      </div>
    );
  }

  return (
    <div className={"dragDropCont"}>
      <div
        className={"dropZoneCont uploadDivs"}
        {...getRootProps()}
        style={{ backgroundColor: isDragActive ? "#F8F8F8" : "white" }}
      >
        <input {...getInputProps()} />
        <div>
          <img className={"uploadImgDD"} src={uploadIcn} alt="Upload" />
        </div>
        <div>
          {isDragActive ? (
            <p>{translate("drop_files_here")}</p>
          ) : (
            <p>{translate("drop_files_here_or_click_to_upload")}</p>
          )}
        </div>
      </div>

      {fileStats}
    </div>
  );
};
