/*This file was generated automatically.
 ************************Your Imports may be different.*************************/
  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { ENVIRONMENT_BASE_API_URL } from '../environments';/*Don't forget to change the path and add a env variable with a connection string file.*/
  import { catchError, map } from 'rxjs/operators';
  import { handleError } from './ChangeFilePath'/*Don't forget to change the path of the handleError file.*/;
  import { Order, ProblemDetails, Product } from './interfaces/ChangeFilePath';/*Don't forget to change the path of the interfaces file.*/


@Injectable({
    providedIn: 'root'
  })
  export class ProductService {
    constructor(private http: HttpClient) { }
 
    public getProduct(): Observable<Array<Product>> {
      return this.http.get<Array<Product>>(`${ENVIRONMENT_BASE_API_URL}/Product`, { observe: 'response' }).pipe(
        map((response: { status: number; body: Array<Product> | null }) => {
          if (response.status === 200 && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }
 
    public postProduct(body: Product): Observable<Product> {
      return this.http.post<Product>(`${ENVIRONMENT_BASE_API_URL}/Product`, body, { observe: 'response' }).pipe(
        map((response: { status: number; body: Product | null }) => {
          if (response.status === 201 && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }
 
    public getId(id: string): Observable<Product> {
      return this.http.get<Product>(`${ENVIRONMENT_BASE_API_URL}/Product/${id}`, { observe: 'response' }).pipe(
        map((response: { status: number; body: Product | null }) => {
          if (response.status === 200 && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }
}